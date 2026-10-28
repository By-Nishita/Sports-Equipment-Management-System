// Tests of the damage rules in damageService.js against a tiny in-memory fake database.
// Run from the backend folder:  node --test tests/damageService.test.js
//
// The fake follows the same "filter + update" behaviour the service relies on, including the
// "only if the status is still X" filters. It is NOT MongoDB, so keep the Checkpoint in the guide.
const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");

// ---------- fake database ----------
let seq = 0;
const newId = () => (++seq).toString(16).padStart(24, "0");

function matches(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("$in" in cond) return cond.$in.map(String).includes(String(value));
      if ("$nin" in cond) return !cond.$nin.map(String).includes(String(value));
      if ("$ne" in cond) return String(value) !== String(cond.$ne);
    }
    return String(value) === String(cond);
  });
}

function makeCollection(defaults = () => ({})) {
  const rows = [];
  const find = (filter) => rows.find((r) => matches(r, filter));
  const copy = (r) => (r ? { ...r } : null);
  return {
    rows,
    async create(doc) { const row = { _id: newId(), ...defaults(), ...doc }; rows.push(row); return copy(row); },
    async findOne(filter) { return copy(find(filter)); },
    async findById(id) { return copy(find({ _id: id })); },
    async exists(filter) { return find(filter) ? { _id: find(filter)._id } : null; },
    async updateOne(filter, update) { const r = find(filter); if (r) Object.assign(r, update); return { modifiedCount: r ? 1 : 0 }; },
    async findOneAndUpdate(filter, update, opts = {}) {
      const r = find(filter);
      if (!r) return null;
      const before = copy(r);
      Object.assign(r, update);
      return opts.new ? copy(r) : before;
    }
  };
}

const reports = makeCollection(() => ({ status: "PENDING", resolution: null, staffNote: "", session: null }));
const units = makeCollection();
const audit = [];

const fakes = {
  mongoose: { isValidObjectId: (id) => /^[0-9a-f]{24}$/.test(String(id)) },
  "../models/DamageReport": reports,
  "../models/EquipmentUnit": units,
  "./auditService": { log: async (e) => { audit.push(e); } }
};
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request in fakes) return fakes[request];
  return realLoad.call(this, request, ...rest);
};
const service = require("../services/damageService");

// ---------- helpers ----------
const student = { _id: newId(), role: "student" };
const staff = { _id: newId(), role: "staff" };
const admin = { _id: newId(), role: "admin" };

async function makeUnit(code, status = "AVAILABLE") {
  return units.create({ unitCode: code, type: newId(), status, condition: "GOOD" });
}
const unitNow = (u) => units.rows.find((r) => r._id === u._id);
const rejects = (promise, status, pattern) =>
  assert.rejects(promise, (err) => err.status === status && (!pattern || pattern.test(err.message)));

// ---------- 1. report ----------
test("a damage report on a shelf unit is PENDING and takes the unit out of use", async () => {
  const u = await makeUnit("FB-001");
  const r = await service.createReport(student, { unitCode: "fb-001", description: "Seam has split" });
  assert.strictEqual(r.status, "PENDING");
  assert.strictEqual(r.source, "STUDENT_REPORT");
  assert.strictEqual(unitNow(u).status, "DAMAGED");
  assert.strictEqual(unitNow(u).condition, "DAMAGED");
  assert.ok(audit.some((a) => a.action === "DAMAGE_REPORTED"));
});

test("a loss report marks the unit LOST", async () => {
  const u = await makeUnit("FB-002");
  await service.createReport(student, { unitCode: "FB-002", description: "Left it at the ground", type: "LOSS" });
  assert.strictEqual(unitNow(u).status, "LOST");
});

test("a unit with a student is not changed by a report", async () => {
  const u = await makeUnit("FB-003", "IN_USE");
  await service.createReport(student, { unitCode: "FB-003", description: "Handle is loose" });
  assert.strictEqual(unitNow(u).status, "IN_USE");
});

test("report checks: bad id, unknown unit, retired unit, short text, double report", async () => {
  await rejects(service.createReport(student, { unitCode: "!!", description: "Something wrong" }), 400);
  await rejects(service.createReport(student, { unitCode: "ZZ-999", description: "Something wrong" }), 404);
  await makeUnit("FB-004", "RETIRED");
  await rejects(service.createReport(student, { unitCode: "FB-004", description: "Something wrong" }), 400, /already marked RETIRED/);
  await makeUnit("FB-005");
  await rejects(service.createReport(student, { unitCode: "FB-005", description: "bad" }), 400, /at least 5/);
  await service.createReport(student, { unitCode: "FB-005", description: "Seam has split" });
  await rejects(service.createReport(student, { unitCode: "FB-005", description: "Seam has split again" }), 409);
});

// ---------- 2. verify ----------
test("staff verify moves PENDING to UNDER_REVIEW once", async () => {
  await makeUnit("FB-010");
  const r = await service.createReport(student, { unitCode: "FB-010", description: "Net is torn" });
  const v = await service.verify(staff, r._id, "Checked at the counter");
  assert.strictEqual(v.status, "UNDER_REVIEW");
  assert.strictEqual(String(v.verifiedBy), String(staff._id));
  assert.strictEqual(v.staffNote, "Checked at the counter");
  await rejects(service.verify(staff, r._id), 409);
  await rejects(service.verify(staff, "not-an-id"), 400);
});

test("two staff verifying at the same instant: exactly one wins", async () => {
  await makeUnit("FB-011");
  const r = await service.createReport(student, { unitCode: "FB-011", description: "Net is torn" });
  const results = await Promise.allSettled([service.verify(staff, r._id), service.verify(staff, r._id)]);
  assert.strictEqual(results.filter((x) => x.status === "fulfilled").length, 1);
});

// ---------- 3. resolve ----------
test("REPAIRED puts the unit back on the shelf in GOOD condition", async () => {
  const u = await makeUnit("FB-020");
  const r = await service.createReport(student, { unitCode: "FB-020", description: "Seam has split" });
  const out = await service.resolve(admin, r._id, { resolution: "REPAIRED", note: "Stitched" });
  assert.strictEqual(out.report.status, "RESOLVED");
  assert.strictEqual(out.report.resolution, "REPAIRED");
  assert.strictEqual(String(out.report.resolvedBy), String(admin._id));
  assert.strictEqual(unitNow(u).status, "AVAILABLE");
  assert.strictEqual(unitNow(u).condition, "GOOD");
  assert.ok(audit.some((a) => a.action === "DAMAGE_RESOLVED" && a.meta.resolution === "REPAIRED"));
});

test("RETIRED and LOST set the unit status to match", async () => {
  const a = await makeUnit("FB-021");
  const ra = await service.createReport(student, { unitCode: "FB-021", description: "Cracked in half" });
  await service.resolve(admin, ra._id, { resolution: "RETIRED" });
  assert.strictEqual(unitNow(a).status, "RETIRED");

  const b = await makeUnit("FB-022");
  const rb = await service.createReport(student, { unitCode: "FB-022", description: "Cannot find it" });
  await service.resolve(admin, rb._id, { resolution: "LOST" });
  assert.strictEqual(unitNow(b).status, "LOST");
});

test("a report from a damaged return (PENDING, counter-verified) can be resolved directly", async () => {
  const u = await makeUnit("FB-023", "DAMAGED");
  const r = await reports.create({ unit: u._id, reportedBy: student._id, verifiedBy: staff._id, source: "RETURN", type: "DAMAGE", description: "Damaged on return" });
  const out = await service.resolve(admin, r._id, { resolution: "REPAIRED" });
  assert.strictEqual(out.report.status, "RESOLVED");
  assert.strictEqual(unitNow(u).status, "AVAILABLE");
});

test("two admins resolving at the same instant: exactly one wins", async () => {
  await makeUnit("FB-024");
  const r = await service.createReport(student, { unitCode: "FB-024", description: "Seam has split" });
  const results = await Promise.allSettled([
    service.resolve(admin, r._id, { resolution: "REPAIRED" }),
    service.resolve(admin, r._id, { resolution: "RETIRED" })
  ]);
  assert.strictEqual(results.filter((x) => x.status === "fulfilled").length, 1);
});

test("a unit that is with a student blocks the resolution and the report is put back", async () => {
  const u = await makeUnit("FB-025");
  const r = await service.createReport(student, { unitCode: "FB-025", description: "Seam has split" });
  await service.verify(staff, r._id);
  units.rows.find((x) => x._id === u._id).status = "IN_USE"; // staff handed it out again
  await rejects(service.resolve(admin, r._id, { resolution: "REPAIRED" }), 409);
  const after = reports.rows.find((x) => x._id === r._id);
  assert.strictEqual(after.status, "UNDER_REVIEW");
  assert.strictEqual(after.resolution, null);
  assert.strictEqual(after.resolvedBy, null);
  assert.strictEqual(unitNow(u).status, "IN_USE");
});

test("a RETIRED unit cannot be repaired back", async () => {
  const u = await makeUnit("FB-026");
  const r = await service.createReport(student, { unitCode: "FB-026", description: "Seam has split" });
  units.rows.find((x) => x._id === u._id).status = "RETIRED";
  await rejects(service.resolve(admin, r._id, { resolution: "REPAIRED" }), 409);
  assert.strictEqual(reports.rows.find((x) => x._id === r._id).status, "PENDING");
});

test("REPAIRED is held back while another report on the same unit is open", async () => {
  const u = await makeUnit("FB-027");
  const other = { _id: newId(), role: "student" };
  const r1 = await service.createReport(student, { unitCode: "FB-027", description: "Seam has split" });
  await service.createReport(other, { unitCode: "FB-027", description: "Also the valve leaks" });
  const out = await service.resolve(admin, r1._id, { resolution: "REPAIRED" });
  assert.strictEqual(out.heldBack, true);
  assert.strictEqual(unitNow(u).status, "DAMAGED");
});

test("resolve checks: bad resolution, bad id, unknown id, already resolved", async () => {
  await makeUnit("FB-028");
  const r = await service.createReport(student, { unitCode: "FB-028", description: "Seam has split" });
  await rejects(service.resolve(admin, r._id, { resolution: "FIXED" }), 400);
  await rejects(service.resolve(admin, "nope", { resolution: "LOST" }), 400);
  await rejects(service.resolve(admin, newId(), { resolution: "LOST" }), 404);
  await service.resolve(admin, r._id, { resolution: "RETIRED" });
  await rejects(service.resolve(admin, r._id, { resolution: "LOST" }), 409, /already resolved/);
});
