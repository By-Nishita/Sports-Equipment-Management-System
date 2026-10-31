const mongoose = require("mongoose");
const UsageSession = require("../models/UsageSession");
const EquipmentType = require("../models/EquipmentType");
const EquipmentUnit = require("../models/EquipmentUnit");
const DamageReport = require("../models/DamageReport");
const settingsService = require("./settingsService");
const auditService = require("./auditService");
const rules = require("./sessionRules");
const { HttpError } = require("../utils/http");

const { CONDITIONS } = UsageSession;
const OPEN_STATUSES = ["ISSUE_PENDING", "ACTIVE", "RETURN_PENDING"];

const requireId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "Invalid id");
};

// ---------------------------------------------------------------- 1. Student asks for an item
async function requestIssue(user, { typeId, acknowledged }) {
  requireId(typeId);
  if (acknowledged !== true) {
    throw new HttpError(400, "Please tick the acknowledgement before requesting");
  }

  const type = await EquipmentType.findById(typeId);
  if (!type || !type.isActive) throw new HttpError(404, "Equipment type not found");
  if (["RESTRICTED", "HIDDEN"].includes(type.availabilityMode)) {
  throw new HttpError(409, "This equipment type is currently unavailable for issue. Please contact staff.");
}
  if (type.trackingMode !== "UNIT") throw new HttpError(400, "This item is issued by quantity, which is not available yet");

  const settings = await settingsService.get();
  const now = new Date();

  // How many things does this student already hold or wait for?
  const open = await UsageSession.find({ user: user._id, status: { $in: OPEN_STATUSES } }).select("type status requestedAt");
  const cutoff = rules.requestCutoff(now, settings.approvalTimeoutMinutes);
  // a waiting request older than the timeout is dead, so it does not count
  const alive = open.filter((s) => s.status !== "ISSUE_PENDING" || s.requestedAt >= cutoff);

  if (alive.length >= settings.maxItemsPerStudent) {
    throw new HttpError(409, `You can hold at most ${settings.maxItemsPerStudent} items at a time`);
  }
  if (alive.some((s) => String(s.type) === String(type._id))) {
    throw new HttpError(409, "You already have a request or an item of this type");
  }

  // Free units minus requests that are already waiting for a unit
  const [freeUnits, waiting] = await Promise.all([
    EquipmentUnit.countDocuments({
  type: type._id,
  status: "AVAILABLE",

}),
    UsageSession.countDocuments({ type: type._id, status: "ISSUE_PENDING", requestedAt: { $gte: cutoff } })
  ]);
  if (freeUnits - waiting < 1) throw new HttpError(409, `No ${type.name} is available right now`);

  let session;
  try {
    // if any dead pending request of this student/type is still lying around, clear it first
    await UsageSession.updateMany(
      { user: user._id, type: type._id, status: "ISSUE_PENDING", requestedAt: { $lt: cutoff } },
      { status: "EXPIRED" }
    );
    session = await UsageSession.create({ type: type._id, user: user._id, acknowledgedAt: now, requestedAt: now });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, "You already have a request for this item");
    throw err;
  }

  await auditService.log({
    actor: user._id, action: "ISSUE_REQUESTED", entityType: "UsageSession", entityId: session._id,
    meta: { type: type.name }
  });
  return session;
}

// ---------------------------------------------------------------- 2. Staff approves (hands over a unit)
async function approve(staff, sessionId, unitCodeInput) {
  requireId(sessionId);
  const session = await UsageSession.findById(sessionId);
  if (!session) throw new HttpError(404, "Request not found");
  if (session.status !== "ISSUE_PENDING") throw new HttpError(409, "This request is no longer waiting for approval");

  const settings = await settingsService.get();
  const now = new Date();

  if (session.requestedAt < rules.requestCutoff(now, settings.approvalTimeoutMinutes)) {
    await UsageSession.updateOne({ _id: session._id, status: "ISSUE_PENDING" }, { status: "EXPIRED" });
    throw new HttpError(409, "This request has expired. Ask the student to request again.");
  }

  const unitCode = String(unitCodeInput || "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(unitCode)) throw new HttpError(400, "Enter the unit ID, like FB-007");

  const type = await EquipmentType.findById(session.type);
  if (!type || !type.isActive) {
  throw new HttpError(404, "Equipment type not found");
}

if (["RESTRICTED", "HIDDEN"].includes(type.availabilityMode)) {
  throw new HttpError(409, "This equipment type is restricted from issuing. Do not hand over this item.");
}

  // ONE atomic step: "take this unit, but only if it is of the right type AND still free".
  // If two staff members try the same unit together, only one of them gets it.
  const unit = await EquipmentUnit.findOneAndUpdate(
    {
  unitCode,
  type: session.type,
  status: "AVAILABLE",

},
    { status: "IN_USE" },
    { new: false } // give us the unit as it was before, so we know its condition
  );
  if (!unit) throw new HttpError(409, `${unitCode} is not available, or it is not a ${type ? type.name : "matching item"}`);

  let updated;
  try {
    updated = await UsageSession.findOneAndUpdate(
      { _id: session._id, status: "ISSUE_PENDING" },
      {
        status: "ACTIVE",
        unit: unit._id,
        approvedBy: staff._id,
        approvedAt: now,
        dueAt: rules.computeDueAt(now, type && type.defaultIssueHours, settings.defaultIssueHours),
        conditionBefore: unit.condition
      },
      { new: true }
    );
  } catch (err) {
    // The unit was already taken above. If saving the session fails (for example a duplicate-key
    // error from the database), give the unit back, otherwise it stays "in use" with nobody using it.
    await EquipmentUnit.updateOne({ _id: unit._id, status: "IN_USE" }, { status: "AVAILABLE" });
    if (err && err.code === 11000) {
      throw new HttpError(409, `${unitCode} could not be issued: the database already has an open record for it. Nothing was changed. Ask the admin to run the unit repair, then try again.`);
    }
    throw err;
  }

  if (!updated) {
    // The request changed while we were working (e.g. expired). Give the unit back.
    await EquipmentUnit.updateOne({ _id: unit._id, status: "IN_USE" }, { status: "AVAILABLE" });
    throw new HttpError(409, "This request is no longer waiting for approval");
  }

  await auditService.log({
    actor: staff._id, action: "ISSUE_APPROVED", entityType: "UsageSession", entityId: updated._id,
    meta: { unitCode, student: String(session.user) }
  });
  return updated;
}

// ---------------------------------------------------------------- 2b. Staff rejects / student cancels
async function reject(staff, sessionId, reason) {
  requireId(sessionId);
  const updated = await UsageSession.findOneAndUpdate(
    { _id: sessionId, status: "ISSUE_PENDING" },
    { status: "REJECTED", rejectedBy: staff._id, rejectReason: String(reason || "").trim().slice(0, 200) },
    { new: true }
  );
  if (!updated) throw new HttpError(409, "This request is no longer waiting for approval");
  await auditService.log({
    actor: staff._id, action: "ISSUE_REJECTED", entityType: "UsageSession", entityId: updated._id,
    meta: { reason: updated.rejectReason }
  });
  return updated;
}

async function cancel(user, sessionId) {
  requireId(sessionId);
  const updated = await UsageSession.findOneAndUpdate(
    { _id: sessionId, user: user._id, status: "ISSUE_PENDING" },
    { status: "REJECTED", rejectedBy: user._id, rejectReason: "Cancelled by student" },
    { new: true }
  );
  if (!updated) throw new HttpError(409, "This request cannot be cancelled");
  await auditService.log({ actor: user._id, action: "ISSUE_CANCELLED", entityType: "UsageSession", entityId: updated._id });
  return updated;
}

// Run every minute from server.js: waiting requests older than the timeout become EXPIRED.
async function expireStaleRequests() {
  const settings = await settingsService.get();
  const cutoff = rules.requestCutoff(new Date(), settings.approvalTimeoutMinutes);
  const result = await UsageSession.updateMany({ status: "ISSUE_PENDING", requestedAt: { $lt: cutoff } }, { status: "EXPIRED" });
  return result.modifiedCount || 0;
}

// ---------------------------------------------------------------- 3. Student asks to return
async function requestReturn(user, { sessionId, conditionClaimed, note }) {
  requireId(sessionId);
  if (!CONDITIONS.includes(conditionClaimed)) throw new HttpError(400, `Condition must be one of ${CONDITIONS.join(", ")}`);
  const text = String(note || "").trim().slice(0, 300);
  if (conditionClaimed === "DAMAGED" && text.length < 3) throw new HttpError(400, "Please describe the damage");

  const session = await UsageSession.findById(sessionId);
  if (!session) throw new HttpError(404, "Session not found");
  const isStaff = user.role === "staff" || user.role === "admin";
  if (!isStaff && String(session.user) !== String(user._id)) throw new HttpError(403, "This is not your item");

  // The late clock stops HERE (returnRequestedAt), not when staff confirms.
  const updated = await UsageSession.findOneAndUpdate(
    { _id: session._id, status: "ACTIVE" },
    { status: "RETURN_PENDING", returnRequestedAt: new Date(), conditionClaimed, conditionNote: text },
    { new: true }
  );
  if (!updated) throw new HttpError(409, "This item is not currently issued");

  await EquipmentUnit.updateOne({ _id: updated.unit, status: "IN_USE" }, { status: "RETURN_PENDING" });
  await auditService.log({
    actor: user._id, action: "RETURN_REQUESTED", entityType: "UsageSession", entityId: updated._id,
    meta: { conditionClaimed }
  });
  return updated;
}

// ---------------------------------------------------------------- 4. Staff confirms the return
async function confirmReturn(staff, sessionId, { conditionVerified, note }) {
  requireId(sessionId);
  if (!CONDITIONS.includes(conditionVerified)) throw new HttpError(400, `Condition must be one of ${CONDITIONS.join(", ")}`);

  const session = await UsageSession.findById(sessionId).populate("unit", "unitCode");
  if (!session) throw new HttpError(404, "Session not found");
  if (session.status !== "RETURN_PENDING") throw new HttpError(409, "This return is not waiting for confirmation");

  const settings = await settingsService.get();
  const late = rules.computeLate(session.dueAt, session.returnRequestedAt, settings.graceMinutes);

  const updated = await UsageSession.findOneAndUpdate(
    { _id: session._id, status: "RETURN_PENDING" },
    {
      status: "RETURNED",
      returnConfirmedBy: staff._id,
      returnedAt: new Date(),
      conditionVerified,
      durationMinutes: rules.computeDuration(session.approvedAt, session.returnRequestedAt),
      wasLate: late.wasLate,
      lateMinutes: late.lateMinutes
    },
    { new: true }
  );
  if (!updated) throw new HttpError(409, "This return was already confirmed");

  const damaged = conditionVerified === "DAMAGED";
  await EquipmentUnit.updateOne(
    { _id: session.unit._id, status: "RETURN_PENDING" },
    { status: damaged ? "DAMAGED" : "AVAILABLE", condition: conditionVerified }
  );

  let report = null;
  if (damaged) {
    report = await DamageReport.create({
      unit: session.unit._id,
      session: session._id,
      reportedBy: session.user,
      verifiedBy: staff._id,
      source: "RETURN",
      type: "DAMAGE",
      description: String(note || session.conditionNote || "Damaged on return").trim().slice(0, 300),
      status: "PENDING"
    });
  }

  await auditService.log({
    actor: staff._id, action: "RETURN_CONFIRMED", entityType: "UsageSession", entityId: updated._id,
    meta: {
      unitCode: session.unit.unitCode,
      conditionClaimed: session.conditionClaimed,
      conditionVerified,
      conditionDiffers: session.conditionClaimed !== conditionVerified,
      wasLate: late.wasLate,
      lateMinutes: late.lateMinutes,
      damageReport: report ? String(report._id) : null
    }
  });
  return { session: updated, damageReport: report };
}

// Staff says: "the item in my hand is NOT the one that was issued." The session stays open.
async function flagMismatch(staff, sessionId, note) {
  requireId(sessionId);
  const text = String(note || "").trim().slice(0, 300);
  if (text.length < 3) throw new HttpError(400, "Please write what you saw (for example the ID on the item)");

  const updated = await UsageSession.findOneAndUpdate(
    { _id: sessionId, status: "RETURN_PENDING" },
    { mismatchFlagged: true },
    { new: true }
  ).populate("unit", "unitCode");
  if (!updated) throw new HttpError(409, "This return is not waiting for confirmation");

  await auditService.log({
    actor: staff._id, action: "RETURN_MISMATCH", entityType: "UsageSession", entityId: updated._id,
    meta: { expectedUnit: updated.unit && updated.unit.unitCode, note: text }
  });
  return updated;
}

module.exports = {
  OPEN_STATUSES,
  requestIssue, approve, reject, cancel, expireStaleRequests,
  requestReturn, confirmReturn, flagMismatch
};