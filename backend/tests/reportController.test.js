// Tests of reportController.js: who may download CSV, audit lines, file name.
// The report service and audit service are replaced by simple fakes, so no database is needed.
// Run from the backend folder:  node --test tests/reportController.test.js
const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");

const auditCalls = [];
let serviceCalls = [];
const fakeService = new Proxy({}, {
  get: (_, name) => async (filters, page) => {
    serviceCalls.push({ name, filters, page });
    return { rows: [{ name: "Football", sessions: 3 }], total: 1, summary: null };
  },
});
const fakeAudit = { log: async (entry) => { auditCalls.push(entry); } };

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (/services\/reportService$/.test(request)) return fakeService;
  if (/services\/auditService$/.test(request)) return fakeAudit;
  return realLoad.call(this, request, parent, isMain);
};
const controller = require("../controllers/reportController");
Module._load = realLoad;

function call(handler, { role = "admin", query = {} } = {}) {
  const res = {
    statusCode: 200, headers: {}, body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    send(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
  const req = { user: { _id: "u1", role }, query };
  return handler(req, res).then(() => res);
}

test.beforeEach(() => { auditCalls.length = 0; serviceCalls = []; });

const range = { from: "2026-10-01", to: "2026-10-20" };

test("staff cannot download a CSV and nothing is read or logged", async () => {
  const res = await call(controller.usageByType, { role: "staff", query: { ...range, format: "csv" } });
  assert.equal(res.statusCode, 403);
  assert.equal(serviceCalls.length, 0);
  assert.equal(auditCalls.length, 0);
});

test("admin CSV: right headers, byte order mark, file name, export is audited", async () => {
  const res = await call(controller.usageByType, { query: { ...range, format: "csv" } });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["Content-Type"], /text\/csv/);
  assert.equal(res.headers["Content-Disposition"], 'attachment; filename="usage-by-type-2026-10-01_2026-10-20.csv"');
  assert.ok(res.body.startsWith("﻿"));
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, "REPORT_EXPORTED");
  assert.equal(auditCalls[0].entityId, "usage-by-type");
});

test("opening the students report is audited, even for staff; usage report is not", async () => {
  const s = await call(controller.students, { role: "staff", query: range });
  assert.equal(s.statusCode, 200);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, "REPORT_VIEWED");
  await call(controller.usageByType, { role: "staff", query: range });
  assert.equal(auditCalls.length, 1);
});

test("a missing or reversed date range is a 400 and the service is not called", async () => {
  const none = await call(controller.usageByType, { query: {} });
  assert.equal(none.statusCode, 400);
  const reversed = await call(controller.usageByType, { query: { from: "2026-10-20", to: "2026-10-01" } });
  assert.equal(reversed.statusCode, 400);
  assert.equal(serviceCalls.length, 0);
});

test("idle report needs no dates; days is clamped to 1..365; CSV name uses the days", async () => {
  const res = await call(controller.idle, { role: "staff", query: { days: "9999" } });
  assert.equal(res.statusCode, 200);
  assert.equal(serviceCalls[0].filters.idleDays, 365);
  const csv = await call(controller.idle, { query: { format: "csv" } });
  assert.equal(csv.headers["Content-Disposition"], 'attachment; filename="idle-last-30-days.csv"');
});

test("list answer has data, pagination and page size is capped at 200", async () => {
  const res = await call(controller.usageByType, { query: { ...range, limit: "9999", page: "2" } });
  assert.equal(res.body.success, true);
  assert.equal(res.body.pagination.limit, 200);
  assert.equal(res.body.pagination.page, 2);
});
