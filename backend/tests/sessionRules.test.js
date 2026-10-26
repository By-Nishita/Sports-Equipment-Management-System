// Unit tests for the pure session rules. No database needed.
// Run from the backend folder:  node --test tests/sessionRules.test.js
const test = require("node:test");
const assert = require("node:assert");
const { computeLate, computeDuration, computeDueAt, requestCutoff } = require("../services/sessionRules");

const T0 = new Date("2026-10-26T10:00:00Z");
const plus = (min) => new Date(T0.getTime() + min * 60000);

test("returned before the due time is not late", () => {
  assert.deepStrictEqual(computeLate(plus(120), plus(100), 15), { wasLate: false, lateMinutes: 0 });
});

test("inside the grace time is not late", () => {
  assert.deepStrictEqual(computeLate(plus(120), plus(130), 15), { wasLate: false, lateMinutes: 0 });
  assert.strictEqual(computeLate(plus(120), plus(135), 15).wasLate, false); // exactly 15 min
});

test("after the grace time it is late, counted from the due time", () => {
  assert.deepStrictEqual(computeLate(plus(120), plus(136), 15), { wasLate: true, lateMinutes: 16 });
});

test("late is measured to the return REQUEST, so slow staff do not make a student late", () => {
  const dueAt = plus(120);
  const requested = plus(118);          // student asked on time
  const confirmedMuchLater = plus(200); // staff was busy
  assert.strictEqual(computeLate(dueAt, requested, 15).wasLate, false);
  assert.strictEqual(computeLate(dueAt, confirmedMuchLater, 15).wasLate, true); // what the OLD wrong way would say
});

test("duration is minutes between approval and return request", () => {
  assert.strictEqual(computeDuration(T0, plus(95)), 95);
  assert.strictEqual(computeDuration(plus(10), plus(5)), 0); // never negative
});

test("due time: type hours win, then settings, then 2", () => {
  assert.strictEqual(computeDueAt(T0, 1, 2).getTime(), plus(60).getTime());
  assert.strictEqual(computeDueAt(T0, 0, 3).getTime(), plus(180).getTime());
  assert.strictEqual(computeDueAt(T0, undefined, undefined).getTime(), plus(120).getTime());
});

test("request cutoff is now minus the timeout", () => {
  assert.strictEqual(requestCutoff(T0, 10).getTime(), plus(-10).getTime());
});