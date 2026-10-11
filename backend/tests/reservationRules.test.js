// Unit tests for the pure booking rules. No database needed.
// Run from the backend folder:  node --test tests/reservationRules.test.js
const test = require("node:test");
const assert = require("node:assert");
const { validateSlot, getClaimDeadline } = require("../services/reservationRules");

const NOW = new Date("2026-10-12T10:00:00+05:30");
const iso = (minutesFromNow) =>
  new Date(NOW.getTime() + minutesFromNow * 60000).toISOString();

test("valid 1-hour slot, claim deadline is start + 15 min", () => {
  const r = validateSlot(iso(60), iso(120), NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.expiresAt.getTime(), r.startTime.getTime() + 15 * 60000);
});

test("4:00 PM-5:00 PM Friday: claim deadline is 4:15 PM", () => {
  const start = "2026-10-16T16:00:00+05:30";
  const end = "2026-10-16T17:00:00+05:30";
  const r = validateSlot(start, end, NOW);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.expiresAt.toISOString(), "2026-10-16T10:45:00.000Z"); // 4:15 PM IST
  assert.strictEqual(getClaimDeadline(r.startTime).getTime(), r.expiresAt.getTime());
});

test("duration limits: 30 and 120 allowed, 29 and 121 rejected", () => {
  assert.strictEqual(validateSlot(iso(60), iso(90), NOW).ok, true);
  assert.strictEqual(validateSlot(iso(60), iso(180), NOW).ok, true);
  assert.strictEqual(validateSlot(iso(60), iso(89), NOW).ok, false);
  assert.strictEqual(validateSlot(iso(60), iso(181), NOW).ok, false);
});

test("end must be after start", () => {
  assert.strictEqual(validateSlot(iso(120), iso(60), NOW).ok, false);
  assert.strictEqual(validateSlot(iso(60), iso(60), NOW).ok, false);
});

test("past start rejected, 30 seconds late tolerated", () => {
  assert.strictEqual(validateSlot(iso(-10), iso(50), NOW).ok, false);
  const slightlyLate = new Date(NOW.getTime() - 30000).toISOString();
  const end = new Date(NOW.getTime() + 40 * 60000).toISOString();
  assert.strictEqual(validateSlot(slightlyLate, end, NOW).ok, true);
});

test("7-day advance limit", () => {
  const day = 24 * 60;
  assert.strictEqual(validateSlot(iso(7 * day), iso(7 * day + 60), NOW).ok, true);
  assert.strictEqual(validateSlot(iso(7 * day + 1), iso(7 * day + 61), NOW).ok, false);
});

test("missing / malformed / no-timezone values rejected", () => {
  assert.strictEqual(validateSlot(undefined, iso(60), NOW).ok, false);
  assert.strictEqual(validateSlot(null, null, NOW).ok, false);
  assert.strictEqual(validateSlot("tomorrow", "later", NOW).ok, false);
  assert.strictEqual(validateSlot("2026-10-16T16:00:00", "2026-10-16T17:00:00", NOW).ok, false);
  assert.strictEqual(validateSlot("2026-13-45T16:00:00Z", "2026-13-45T17:00:00Z", NOW).ok, false);
  assert.strictEqual(validateSlot(1760000000000, 1760003600000, NOW).ok, false);
  assert.strictEqual(validateSlot({}, [], NOW).ok, false);
});
