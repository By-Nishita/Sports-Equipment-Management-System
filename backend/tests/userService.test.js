// Tests of userService.updateUser with fake models (no MongoDB).
// Run from the backend folder:  node --test tests/userService.test.js
const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");

const audit = [];
const users = [];
let sessions = [];
const matchesFilter = (u, f) => Object.entries(f).every(([k, c]) => (c && c.$ne !== undefined ? String(u[k]) !== String(c.$ne) : String(u[k]) === String(c)));

const query = (v) => ({ select: async () => (v ? { ...v } : null) });
const fakes = {
  mongoose: { isValidObjectId: (id) => /^[0-9a-f]{24}$/.test(String(id)) },
  "../models/User": {
    findById: (id) => query(users.find((u) => u._id === id)),
    findOneAndUpdate: (f, ch) => {
      const u = users.find((x) => matchesFilter(x, f));
      if (u) Object.assign(u, ch);
      return query(u);
    }
  },
  "../models/UsageSession": { exists: async (f) => (sessions.some((s) => s.user === f.user && f.status.$in.includes(s.status)) ? { _id: 1 } : null) },
  "./auditService": { log: async (e) => { audit.push(e); } }
};
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request in fakes) return fakes[request];
  return realLoad.call(this, request, ...rest);
};
const service = require("../services/userService");

const id = (n) => String(n).repeat(24).slice(0, 24);
const admin = { _id: id(9), role: "admin" };
const reset = () => {
  users.length = 0; audit.length = 0; sessions = [];
  users.push({ _id: id(1), role: "student", isActive: true, srn: "S1", email: "s1@c.edu" });
  users.push({ _id: id(2), role: "admin", isActive: true });
};
const rejects = (p, status, re) => assert.rejects(p, (e) => e.status === status && (!re || re.test(e.message)));

test("deactivate closes the account, logs everyone out and writes an audit row", async () => {
  reset();
  const u = await service.updateUser(admin, id(1), { isActive: false });
  assert.strictEqual(u.isActive, false);
  assert.ok(users[0].passwordChangedAt instanceof Date);
  assert.ok(audit.some((a) => a.action === "USER_DEACTIVATED"));
});

test("a person who still holds an item cannot be deactivated", async () => {
  reset();
  sessions = [{ user: id(1), status: "ACTIVE" }];
  await rejects(service.updateUser(admin, id(1), { isActive: false }), 409, /not returned/);
  assert.strictEqual(users[0].isActive, true);
});

test("reactivate works and is audited", async () => {
  reset();
  users[0].isActive = false;
  const u = await service.updateUser(admin, id(1), { isActive: true });
  assert.strictEqual(u.isActive, true);
  assert.ok(audit.some((a) => a.action === "USER_REACTIVATED"));
});

test("role can be student or staff, never admin", async () => {
  reset();
  const u = await service.updateUser(admin, id(1), { role: "staff" });
  assert.strictEqual(u.role, "staff");
  assert.ok(audit.some((a) => a.action === "USER_ROLE_CHANGED"));
  await rejects(service.updateUser(admin, id(1), { role: "admin" }), 400);
});

test("admin accounts cannot be changed here", async () => {
  reset();
  await rejects(service.updateUser(admin, id(2), { isActive: false }), 403);
});

test("bad input: unknown field, empty body, wrong type, bad id, unknown user", async () => {
  reset();
  await rejects(service.updateUser(admin, id(1), { password: "x" }), 400);
  await rejects(service.updateUser(admin, id(1), {}), 400, /Nothing to change/);
  await rejects(service.updateUser(admin, id(1), { isActive: "no" }), 400);
  await rejects(service.updateUser(admin, "nope", { isActive: false }), 400);
  await rejects(service.updateUser(admin, id(5), { isActive: false }), 404);
});

test("asking for what is already true changes nothing and writes no audit row", async () => {
  reset();
  await service.updateUser(admin, id(1), { isActive: true });
  assert.strictEqual(audit.length, 0);
});
