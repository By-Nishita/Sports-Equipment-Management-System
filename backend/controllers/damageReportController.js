const damageService = require("../services/damageService");
const { ok, handle, parsePage } = require("../utils/http");

const pagination = (page, limit, total) => ({ pagination: { page, limit, total, pages: Math.ceil(total / limit) } });

// POST /api/damage-reports   { unitCode, description, type }   (all roles)
const create = handle(async (req, res) => {
  const report = await damageService.createReport(req.user, req.body || {});
  ok(res, report, "Report submitted. Staff will review it.", 201);
});

// GET /api/damage-reports/my   (all roles) - own reports, newest first
const mine = handle(async (req, res) => {
  const { page, limit, skip } = parsePage(req.query);
  const { rows, total } = await damageService.list({ skip, limit, reportedBy: req.user._id });
  ok(res, rows, "OK", 200, pagination(page, limit, total));
});

// GET /api/damage-reports?status=PENDING   (staff, admin)
const listAll = handle(async (req, res) => {
  const { page, limit, skip } = parsePage(req.query);
  const { rows, total } = await damageService.list({ status: req.query.status, skip, limit });
  ok(res, rows, "OK", 200, pagination(page, limit, total));
});

// PATCH /api/damage-reports/:id/verify   { note }   (staff, admin): PENDING -> UNDER_REVIEW
const verify = handle(async (req, res) => {
  const report = await damageService.verify(req.user, req.params.id, (req.body || {}).note);
  ok(res, report, "Report verified. It is now under review.");
});

// PATCH /api/damage-reports/:id/resolve   { resolution, note }   (admin only)
const resolve = handle(async (req, res) => {
  const { report, heldBack } = await damageService.resolve(req.user, req.params.id, req.body || {});
  ok(
    res,
    report,
    heldBack
      ? "Report resolved. The unit stays out of use: another report on it is still open."
      : "Report resolved."
  );
});

module.exports = { create, mine, listAll, verify, resolve };
