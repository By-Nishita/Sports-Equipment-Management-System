// Tests of profileService.js with fake models (no MongoDB).
// Run from the backend folder:  node --test tests/profileService.test.js
const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");

const audit = [];
let aggregateResult = [];
let lastPipeline = null;
const users = [{ _id: "a".repeat(24), name: "Asha", phone: "", photoUrl: "" }];
let uploaded = null;

const query = (value) => ({ select: async () => value });
const fakes = {
  mongoose: { Types: { ObjectId: function (id) { return { oid: String(id) }; } } },
  "../models/User": {
    findById: (id) => query(users.find((u) => u._id === String(id)) || null),
    findByIdAndUpdate: (id, update) => {
      const u = users.find((x) => x._id === String(id));
      Object.assign(u, update);
      return query({ ...u });
    }
  },
  "../models/UsageSession": { aggregate: async (pipeline) => { lastPipeline = pipeline; return aggregateResult; } },
  "./auditService": { log: async (e) => { audit.push(e); } },
  "./photoService": { uploadProfilePhoto: async (buf, id) => { uploaded = { buf, id }; return { photoUrl: "https://img/x.webp" }; } }
};
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request in fakes) return fakes[request];
  return realLoad.call(this, request, ...rest);
};
const service = require("../services/profileService");

const me = { _id: "a".repeat(24) };
const rejects = (p, status) => assert.rejects(p, (e) => e.status === status);

test("a student with no sessions gets zeros and no on-time percent", async () => {
  aggregateResult = [];
  const { user, stats } = await service.getProfile(me._id);
  assert.strictEqual(user.name, "Asha");
  assert.deepStrictEqual(stats, { totalSessions: 0, totalHours: 0, onTimePercent: null, itemsHeldNow: 0 });
});

test("stats are built from the aggregation row", async () => {
  aggregateResult = [{ returned: 4, late: 1, minutes: 135, holding: 2 }];
  const { stats } = await service.getProfile(me._id);
  assert.deepStrictEqual(stats, { totalSessions: 4, totalHours: 2.3, onTimePercent: 75, itemsHeldNow: 2 });
});

test("the aggregation only looks at this user's sessions", async () => {
  await service.getProfile(me._id);
  assert.deepStrictEqual(lastPipeline[0], { $match: { user: { oid: me._id } } });
});

test("an unknown user is a 404", async () => {
  await rejects(service.getProfile("b".repeat(24)), 404);
});

test("updatePhone saves a cleaned number and writes an audit row", async () => {
  const u = await service.updatePhone(me, " 98765 43210 ");
  assert.strictEqual(u.phone, "9876543210");
  assert.ok(audit.some((a) => a.action === "PROFILE_UPDATED" && a.meta.field === "phone"));
});

test("updatePhone can clear the number and refuses a bad one", async () => {
  assert.strictEqual((await service.updatePhone(me, "")).phone, "");
  await rejects(service.updatePhone(me, "123"), 400);
  assert.strictEqual(users[0].phone, "");
});

test("setPhoto needs a file, then stores the new url", async () => {
  await rejects(service.setPhoto(me, undefined), 400);
  const u = await service.setPhoto(me, Buffer.from("img"));
  assert.strictEqual(u.photoUrl, "https://img/x.webp");
  assert.strictEqual(uploaded.id, me._id);
});
