const mongoose = require("mongoose");
const DamageReport = require("../models/DamageReport");
const EquipmentUnit = require("../models/EquipmentUnit");
const auditService = require("./auditService");
const rules = require("./damageRules");
const { HttpError } = require("../utils/http");

const requireId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "Invalid id");
};

const cleanNote = (value, max = 1000) => String(value || "").trim().slice(0, max);

// Same fields everywhere, so every list looks the same to the frontend.
const POPULATE = [
  { path: "unit", select: "unitCode status condition type", populate: { path: "type", select: "name category thumbUrl imageUrl" } },
  { path: "reportedBy", select: "name srn" },
  { path: "verifiedBy", select: "name" },
  { path: "resolvedBy", select: "name" }
];

// ---------------------------------------------------------------- 1. Anyone reports a problem
async function createReport(user, { unitCode: unitCodeInput, description, type = "DAMAGE" }) {
  const unitCode = String(unitCodeInput || "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(unitCode)) throw new HttpError(400, "Enter the unit ID printed on the item, like FB-007");
  if (!["DAMAGE", "LOSS"].includes(type)) throw new HttpError(400, "type must be DAMAGE or LOSS");
  const text = cleanNote(description, 1000);
  if (text.length < 5) throw new HttpError(400, "Please describe the problem (at least 5 characters)");

  const unit = await EquipmentUnit.findOne({ unitCode });
  if (!unit) throw new HttpError(404, `No item with ID ${unitCode}`);
  if (["RETIRED", "LOST"].includes(unit.status)) throw new HttpError(400, `${unitCode} is already marked ${unit.status}`);

  // The same person cannot keep two open reports on one unit
  const already = await DamageReport.exists({
    unit: unit._id,
    reportedBy: user._id,
    status: { $in: rules.OPEN_REPORT_STATUSES }
  });
  if (already) throw new HttpError(409, "You already have an open report for this item");

  const report = await DamageReport.create({
    unit: unit._id,
    reportedBy: user._id,
    source: "STUDENT_REPORT",
    type,
    description: text
  });

  // A unit on the shelf is taken out of use at once, so nobody else is given it.
  // One atomic step: only if it is still AVAILABLE. A unit that is with a student is left alone;
  // the return flow handles it.
  const newStatus = rules.unitStatusForNewReport(type);
  await EquipmentUnit.updateOne(
    { _id: unit._id, status: "AVAILABLE" },
    newStatus === "DAMAGED" ? { status: "DAMAGED", condition: "DAMAGED" } : { status: "LOST" }
  );

  await auditService.log({
    actor: user._id, action: "DAMAGE_REPORTED", entityType: "DamageReport", entityId: report._id,
    meta: { unitCode, type }
  });
  return report;
}

// ---------------------------------------------------------------- 2. Staff verifies
async function verify(staff, reportId, note) {
  requireId(reportId);
  const changes = { status: "UNDER_REVIEW", verifiedBy: staff._id, verifiedAt: new Date() };
  const text = cleanNote(note);
  if (text) changes.staffNote = text;

  // Only a PENDING report can be verified, and only once
  const updated = await DamageReport.findOneAndUpdate(
    { _id: reportId, status: "PENDING" },
    changes,
    { new: true }
  );
  if (!updated) throw new HttpError(409, "This report was already checked. Refresh the list.");

  await auditService.log({
    actor: staff._id, action: "DAMAGE_VERIFIED", entityType: "DamageReport", entityId: updated._id,
    meta: { unit: String(updated.unit) }
  });
  return updated;
}

// ---------------------------------------------------------------- 3. Admin resolves
async function resolve(admin, reportId, { resolution, note }) {
  requireId(reportId);
  if (!rules.RESOLUTIONS.includes(resolution)) {
    throw new HttpError(400, `resolution must be one of ${rules.RESOLUTIONS.join(", ")}`);
  }

  // Step 1: claim the report. Only an open report can be resolved, and only once.
  const before = await DamageReport.findOneAndUpdate(
    { _id: reportId, status: { $in: rules.OPEN_REPORT_STATUSES } },
    {
      status: "RESOLVED",
      resolution,
      resolvedBy: admin._id,
      resolvedAt: new Date(),
      ...(cleanNote(note) ? { staffNote: cleanNote(note) } : {})
    },
    { new: false } // the report as it was, so we can put it back if the unit step fails
  );
  if (!before) {
    const exists = await DamageReport.exists({ _id: reportId });
    throw new HttpError(exists ? 409 : 404, exists ? "This report was already resolved. Refresh the list." : "Report not found");
  }

  // Step 2: change the unit, but never one that is with a student (one atomic step).
  // REPAIRED is held back if another report on the same unit is still open.
  let unitStatus = rules.unitStatusForResolution(resolution);
  let heldBack = false;
  if (resolution === "REPAIRED") {
    const otherOpen = await DamageReport.exists({
      unit: before.unit,
      _id: { $ne: before._id },
      status: { $in: rules.OPEN_REPORT_STATUSES }
    });
    if (otherOpen) heldBack = true;
  }

  if (!heldBack) {
    const unitUpdate = resolution === "REPAIRED" ? { status: unitStatus, condition: "GOOD" } : { status: unitStatus };
    const unit = await EquipmentUnit.findOneAndUpdate(
      { _id: before.unit, status: { $nin: rules.unitStatusesBlocking(resolution) } },
      unitUpdate,
      { new: true }
    );
    if (!unit) {
      // The unit is with a student (or retired): put the report back as it was.
      await DamageReport.updateOne(
        { _id: before._id, status: "RESOLVED" },
        {
          status: before.status,
          resolution: null,
          resolvedBy: null,
          resolvedAt: null,
          staffNote: before.staffNote
        }
      );
      throw new HttpError(
        409,
        resolution === "REPAIRED"
          ? "This unit is with a student or already retired. Resolve it after it is returned."
          : "This unit is currently with a student. Resolve the report after it is returned."
      );
    }
  }

  const updated = await DamageReport.findById(before._id);
  await auditService.log({
    actor: admin._id, action: "DAMAGE_RESOLVED", entityType: "DamageReport", entityId: before._id,
    meta: { unit: String(before.unit), resolution, unitStatus: heldBack ? "unchanged (another report is open)" : unitStatus }
  });
  return { report: updated, heldBack };
}

// ---------------------------------------------------------------- lists
async function list({ status, skip, limit, reportedBy }) {
  const filter = {};
  if (status !== undefined) {
    if (!["PENDING", "UNDER_REVIEW", "RESOLVED"].includes(status)) {
      throw new HttpError(400, "status must be PENDING, UNDER_REVIEW or RESOLVED");
    }
    filter.status = status;
  }
  if (reportedBy) filter.reportedBy = reportedBy;

  const [rows, total] = await Promise.all([
    DamageReport.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    DamageReport.countDocuments(filter)
  ]);
  return { rows, total };
}

module.exports = { createReport, verify, resolve, list };
