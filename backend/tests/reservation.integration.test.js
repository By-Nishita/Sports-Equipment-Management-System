// Integration test for N1 (slot-based reservations). NEEDS a MongoDB.
//
// SAFETY: it never touches your real database. It creates a brand-new
// database with a random name, runs the tests there and drops ONLY that
// database at the end. Point TEST_MONGO_URI at any MongoDB server
// (a local one, or your Atlas cluster - the random database is separate).
//
// Run from the backend folder:
//   TEST_MONGO_URI="mongodb://127.0.0.1:27017" node --test tests/reservation.integration.test.js
// (Windows PowerShell:  $env:TEST_MONGO_URI="mongodb://127.0.0.1:27017"; node --test tests/reservation.integration.test.js)

const test = require("node:test");
const assert = require("node:assert");
const mongoose = require("mongoose");

const uri = process.env.TEST_MONGO_URI;
if (!uri) {
  console.error("Set TEST_MONGO_URI first (see comment at top of this file).");
  process.exit(1);
}

const { User, Equipment, Reservation, UsageSession } = require("../models");
const {
  createReservation,
  cancelReservation,
  getMyReservations
} = require("../controllers/reservationController");
const { issueEquipment } = require("../controllers/sessionController");
const { getEquipment } = require("../controllers/equipmentController");

// ---- helpers --------------------------------------------------------
const call = async (handler, { user, body = {}, params = {} }) => {
  const out = { status: 200, body: null };
  const res = {
    status(c) { out.status = c; return this; },
    json(b) { out.body = b; return this; }
  };
  await handler({ user, body, params }, res);
  return out;
};

const MIN = 60 * 1000;
// Fixed reference time, so "end of one slot" equals "start of the next" exactly
const T0 = Date.now();
const at = (minutesFromNow) => new Date(T0 + minutesFromNow * MIN).toISOString();

let n = 0;
const makeUser = (role = "student") =>
  User.create({
    name: `T${++n}`, email: `t${n}-${Date.now()}@test.local`,
    password: "x", role, department: "Sports"
  });
const makeEquip = (status = "AVAILABLE") =>
  Equipment.create({
    equipmentId: `T-${++n}-${Date.now()}`, name: "Test ball", category: "Test",
    status, qrIdentifier: `qr-${n}-${Date.now()}`
  });

let a, b, c, staff;

test.before(async () => {
  await mongoose.connect(uri, { dbName: `sems_n1_test_${Date.now()}` });
  console.log("Using temporary database:", mongoose.connection.name);
  await Promise.all([Reservation.init(), Equipment.init(), UsageSession.init()]);
  [a, b, c, staff] = await Promise.all([
    makeUser(), makeUser(), makeUser(), makeUser("staff")
  ]);
});

test.after(async () => {
  await mongoose.connection.dropDatabase(); // the random test database only
  await mongoose.disconnect();
});

// ---- tests ----------------------------------------------------------
test("creates a slot reservation and does NOT change equipment status", async () => {
  const eq = await makeEquip();
  const r = await call(createReservation, {
    user: a, body: { equipmentId: eq.equipmentId, startTime: at(60), endTime: at(120) }
  });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.reservation.status, "ACTIVE");
  assert.strictEqual(
    new Date(r.body.reservation.expiresAt).getTime(),
    new Date(r.body.reservation.startTime).getTime() + 15 * MIN
  );
  assert.strictEqual((await Equipment.findById(eq._id)).status, "AVAILABLE");
});

test("rejects bad input (missing, too short, too long, past, too far ahead)", async () => {
  const eq = await makeEquip();
  const bad = async (startTime, endTime) =>
    (await call(createReservation, { user: a, body: { equipmentId: eq.equipmentId, startTime, endTime } })).status;
  assert.strictEqual(await bad(undefined, undefined), 400);
  assert.strictEqual(await bad(at(60), at(80)), 400);      // 20 min
  assert.strictEqual(await bad(at(60), at(200)), 400);     // 140 min
  assert.strictEqual(await bad(at(-30), at(30)), 400);     // past
  assert.strictEqual(await bad(at(8 * 24 * 60), at(8 * 24 * 60 + 60)), 400); // 8 days
  assert.strictEqual((await call(createReservation, { user: a, body: {} })).status, 400);
  assert.strictEqual(
    (await call(createReservation, { user: a, body: { equipmentId: "NOPE", startTime: at(60), endTime: at(90) } })).status, 404);
});

test("overlap rejected, back-to-back allowed, other student cannot overlap", async () => {
  const eq = await makeEquip();
  const make = (user, s, e) =>
    call(createReservation, { user, body: { equipmentId: eq.equipmentId, startTime: at(s), endTime: at(e) } });
  assert.strictEqual((await make(a, 60, 120)).status, 201);
  assert.strictEqual((await make(b, 90, 150)).status, 409);   // partial overlap
  assert.strictEqual((await make(a, 70, 100)).status, 409);   // inside, same student
  assert.strictEqual((await make(b, 30, 90)).status, 409);    // overlaps start
  assert.strictEqual((await make(b, 120, 150)).status, 201);  // starts exactly when A ends
  assert.strictEqual((await make(b, 0 + 30, 60)).status, 201); // ends exactly when A starts
});

test("one student can hold several reservations (different equipment / slots)", async () => {
  const e1 = await makeEquip(), e2 = await makeEquip();
  const make = (eq, s, e) =>
    call(createReservation, { user: c, body: { equipmentId: eq.equipmentId, startTime: at(s), endTime: at(e) } });
  assert.strictEqual((await make(e1, 60, 120)).status, 201);
  assert.strictEqual((await make(e1, 200, 260)).status, 201);
  assert.strictEqual((await make(e2, 60, 120)).status, 201);
});

test("concurrent requests for the same slot: exactly one wins", async () => {
  const eq = await makeEquip();
  const users = await Promise.all([1, 2, 3, 4, 5, 6].map(() => makeUser()));
  const results = await Promise.all(users.map((u) =>
    call(createReservation, { user: u, body: { equipmentId: eq.equipmentId, startTime: at(60), endTime: at(120) } })));
  const wins = results.filter((r) => r.status === 201).length;
  assert.strictEqual(wins, 1, JSON.stringify(results.map((r) => r.status)));
  assert.strictEqual(await Reservation.countDocuments({ equipment: eq._id, status: "ACTIVE" }), 1);
});

test("IN_USE equipment: allowed only if due back before the slot", async () => {
  const eq = await makeEquip("IN_USE");
  await UsageSession.create({ equipment: eq._id, user: b._id, dueAt: new Date(Date.now() + 60 * MIN) });
  const make = (s, e) =>
    call(createReservation, { user: a, body: { equipmentId: eq.equipmentId, startTime: at(s), endTime: at(e) } });
  assert.strictEqual((await make(30, 60)).status, 400);   // due back at +60, slot starts +30
  assert.strictEqual((await make(90, 120)).status, 201);  // due back before slot
  assert.strictEqual((await Equipment.findById(eq._id)).status, "IN_USE"); // unchanged
});

test("DAMAGED / RETIRED / LOST / MAINTENANCE equipment cannot be reserved", async () => {
  for (const status of ["DAMAGED", "RETIRED", "LOST", "MAINTENANCE"]) {
    const eq = await makeEquip(status);
    const r = await call(createReservation, { user: a, body: { equipmentId: eq.equipmentId, startTime: at(60), endTime: at(90) } });
    assert.strictEqual(r.status, 400, status);
  }
});

test("no-show: unclaimed after start + 15 min becomes NO_SHOW and frees the slot", async () => {
  const eq = await makeEquip();
  const r = await call(createReservation, { user: a, body: { equipmentId: eq.equipmentId, startTime: at(60), endTime: at(120) } });
  // Move the reservation into the past (simulate time passing): slot started 20 min ago
  await Reservation.updateOne({ _id: r.body.reservation._id }, {
    startTime: new Date(Date.now() - 20 * MIN), endTime: new Date(Date.now() + 40 * MIN),
    expiresAt: new Date(Date.now() - 5 * MIN)
  });
  const mine = await call(getMyReservations, { user: a });
const foundReservation = mine.body.find(
  (x) => String(x._id) === String(r.body.reservation._id)
);

assert.ok(foundReservation, "Reservation should be present in my reservations");
assert.strictEqual(foundReservation.status, "NO_SHOW");
  // the rest of that slot can now be booked by someone else
  const again = await call(createReservation, { user: b, body: { equipmentId: eq.equipmentId, startTime: at(5), endTime: at(40) } });
  assert.strictEqual(again.status, 201);
});

test("cancel: owner can, other student cannot, staff can, cancelled slot is free again", async () => {
  const eq = await makeEquip();
  const make = (user) => call(createReservation, { user, body: { equipmentId: eq.equipmentId, startTime: at(60), endTime: at(120) } });
  const r = await make(a);
  const id = r.body.reservation._id;
  assert.strictEqual((await call(cancelReservation, { user: b, params: { id } })).status, 403);
  assert.strictEqual((await call(cancelReservation, { user: a, params: { id } })).status, 200);
  assert.strictEqual((await call(cancelReservation, { user: a, params: { id } })).status, 400); // already cancelled
  const r2 = await make(b);
  assert.strictEqual(r2.status, 201);
  assert.strictEqual((await call(cancelReservation, { user: staff, params: { id: r2.body.reservation._id } })).status, 200);
});

test("issue: another student cannot bypass a started reservation, owner claims it", async () => {
  const eq = await makeEquip();
  const r = await call(createReservation, { user: a, body: { equipmentId: eq.equipmentId, startTime: at(60), endTime: at(120) } });
  // slot started 5 min ago, deadline in 10 min
  await Reservation.updateOne({ _id: r.body.reservation._id }, {
    startTime: new Date(Date.now() - 5 * MIN), endTime: new Date(Date.now() + 55 * MIN),
    expiresAt: new Date(Date.now() + 10 * MIN)
  });
  const blocked = await call(issueEquipment, { user: b, body: { equipmentId: eq.equipmentId } });
  assert.strictEqual(blocked.status, 403);
  assert.strictEqual((await Equipment.findById(eq._id)).status, "AVAILABLE");

  const ok = await call(issueEquipment, { user: a, body: { equipmentId: eq.equipmentId } });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.body.session.issuedVia, "RESERVATION");
  assert.strictEqual((await Equipment.findById(eq._id)).status, "IN_USE");
  assert.strictEqual((await Reservation.findById(r.body.reservation._id)).status, "FULFILLED");
});

test("issue: a reservation for a LATER slot does not block direct issue now", async () => {
  const eq = await makeEquip();
  await call(createReservation, { user: a, body: { equipmentId: eq.equipmentId, startTime: at(300), endTime: at(360) } });
  const r = await call(issueEquipment, { user: b, body: { equipmentId: eq.equipmentId } });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.session.issuedVia, "DIRECT");
});

test("issue: after the no-show deadline the equipment is free for anyone", async () => {
  const eq = await makeEquip();
  const r = await call(createReservation, { user: a, body: { equipmentId: eq.equipmentId, startTime: at(60), endTime: at(120) } });
  await Reservation.updateOne({ _id: r.body.reservation._id }, {
    startTime: new Date(Date.now() - 20 * MIN), endTime: new Date(Date.now() + 40 * MIN),
    expiresAt: new Date(Date.now() - 5 * MIN)
  });
  const ok = await call(issueEquipment, { user: b, body: { equipmentId: eq.equipmentId } });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual((await Reservation.findById(r.body.reservation._id)).status, "NO_SHOW");
});

test("old reservations (no startTime) are preserved and still expire as EXPIRED", async () => {
  const eq = await makeEquip();
  // insert an OLD-style document directly, bypassing the new fields
  const old = await Reservation.collection.insertOne({
    equipment: eq._id, user: a._id, status: "ACTIVE",
    expiresAt: new Date(Date.now() - MIN), createdAt: new Date(Date.now() - 31 * MIN), updatedAt: new Date()
  });
  await call(getEquipment, { user: a });
  const doc = await Reservation.collection.findOne({ _id: old.insertedId });
  assert.strictEqual(doc.status, "EXPIRED");
  assert.ok(!("startTime" in doc) || doc.startTime === null); // no invented times
});

test("a still-running old 30-minute hold blocks an overlapping new slot", async () => {
  const eq = await makeEquip();
  await Reservation.collection.insertOne({
    equipment: eq._id, user: a._id, status: "ACTIVE",
    expiresAt: new Date(Date.now() + 20 * MIN), createdAt: new Date(Date.now() - 10 * MIN), updatedAt: new Date()
  });
  const r = await call(createReservation, { user: b, body: { equipmentId: eq.equipmentId, startTime: at(5), endTime: at(40) } });
  assert.strictEqual(r.status, 409);
});
