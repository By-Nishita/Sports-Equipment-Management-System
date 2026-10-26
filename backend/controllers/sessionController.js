const UsageSession = require("../models/UsageSession");
const settingsService = require("../services/settingsService");
const sessionService = require("../services/sessionService");
const rules = require("../services/sessionRules");
const { ok, handle, parsePage } = require("../utils/http");

// Same fields everywhere, so every list looks the same to the frontend.
const POPULATE = [
  { path: "user", select: "name srn phone photoUrl" },
  { path: "type", select: "name category imageUrl thumbUrl qrIdentifier" },
  { path: "unit", select: "unitCode condition" }
];

const list = async (req, res, filter, sort, { message = "OK" } = {}) => {
  const { page, limit, skip } = parsePage(req.query);
  const [rows, total] = await Promise.all([
    UsageSession.find(filter).populate(POPULATE).sort(sort).skip(skip).limit(limit),
    UsageSession.countDocuments(filter)
  ]);
  ok(res, rows, message, 200, { pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

// ---------- actions ----------
const requestIssue = handle(async (req, res) => {
  const session = await sessionService.requestIssue(req.user, req.body || {});
  ok(res, session, "Request sent. Waiting for staff approval.", 201);
});

const approve = handle(async (req, res) => {
  const session = await sessionService.approve(req.user, req.params.id, (req.body || {}).unitCode);
  ok(res, session, "Issue approved");
});

const reject = handle(async (req, res) => {
  const session = await sessionService.reject(req.user, req.params.id, (req.body || {}).reason);
  ok(res, session, "Request rejected");
});

const cancel = handle(async (req, res) => {
  const session = await sessionService.cancel(req.user, req.params.id);
  ok(res, session, "Request cancelled");
});

const requestReturn = handle(async (req, res) => {
  const session = await sessionService.requestReturn(req.user, req.body || {});
  ok(res, session, "Return requested. Show the item to staff.");
});

const confirmReturn = handle(async (req, res) => {
  const result = await sessionService.confirmReturn(req.user, req.params.id, req.body || {});
  ok(res, result, result.damageReport ? "Return confirmed. A damage report was created." : "Return confirmed");
});

const flagMismatch = handle(async (req, res) => {
  const session = await sessionService.flagMismatch(req.user, req.params.id, (req.body || {}).note);
  ok(res, session, "Mismatch recorded");
});

// ---------- lists ----------
// Student: own sessions. ?open=true => only the ones still in progress.
const mySessions = handle(async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.open === "true") filter.status = { $in: sessionService.OPEN_STATUSES };
  await list(req, res, filter, { createdAt: -1 });
});

// Staff: requests waiting for a unit (only those not past the timeout), oldest first.
const pendingApprovals = handle(async (req, res) => {
  const settings = await settingsService.get();
  const cutoff = rules.requestCutoff(new Date(), settings.approvalTimeoutMinutes);
  await list(req, res, { status: "ISSUE_PENDING", requestedAt: { $gte: cutoff } }, { requestedAt: 1 });
});

// Staff: returns waiting to be checked, oldest first.
const pendingReturns = handle(async (req, res) => {
  await list(req, res, { status: "RETURN_PENDING" }, { returnRequestedAt: 1 });
});

// Staff: everything currently out.
const activeSessions = handle(async (req, res) => {
  await list(req, res, { status: "ACTIVE" }, { dueAt: 1 });
});

// Staff: out and past the due time, the most late first. Adds minutesLate.
const overdueSessions = handle(async (req, res) => {
  const now = new Date();
  const { page, limit, skip } = parsePage(req.query);
  const filter = { status: "ACTIVE", dueAt: { $lt: now } };
  const [rows, total] = await Promise.all([
    UsageSession.find(filter).populate(POPULATE).sort({ dueAt: 1 }).skip(skip).limit(limit),
    UsageSession.countDocuments(filter)
  ]);
  const data = rows.map((s) => ({ ...s.toJSON(), minutesLate: Math.floor((now - s.dueAt) / 60000) }));
  ok(res, data, "OK", 200, { pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

module.exports = {
  requestIssue, approve, reject, cancel, requestReturn, confirmReturn, flagMismatch,
  mySessions, pendingApprovals, pendingReturns, activeSessions, overdueSessions
};