// Unit tests for the pure damage rules. No database needed.
// Run from the backend folder:  node --test tests/damageRules.test.js
const test = require("node:test");
const assert = require("node:assert");
const rules = require("../services/damageRules");

test("a resolution decides the unit status", () => {
  assert.strictEqual(rules.unitStatusForResolution("REPAIRED"), "AVAILABLE");
  assert.strictEqual(rules.unitStatusForResolution("RETIRED"), "RETIRED");
  assert.strictEqual(rules.unitStatusForResolution("LOST"), "LOST");
  assert.strictEqual(rules.unitStatusForResolution("anything else"), null);
});

test("a new report takes a unit off the shelf: damage -> DAMAGED, loss -> LOST", () => {
  assert.strictEqual(rules.unitStatusForNewReport("DAMAGE"), "DAMAGED");
  assert.strictEqual(rules.unitStatusForNewReport("LOSS"), "LOST");
});

test("a unit with a student is never changed by a resolution", () => {
  for (const r of rules.RESOLUTIONS) {
    const blocked = rules.unitStatusesBlocking(r);
    assert.ok(blocked.includes("IN_USE"));
    assert.ok(blocked.includes("RETURN_PENDING"));
  }
});

test("only REPAIRED is blocked on a RETIRED unit", () => {
  assert.ok(rules.unitStatusesBlocking("REPAIRED").includes("RETIRED"));
  assert.ok(!rules.unitStatusesBlocking("RETIRED").includes("RETIRED"));
  assert.ok(!rules.unitStatusesBlocking("LOST").includes("RETIRED"));
});

test("open report statuses", () => {
  assert.deepStrictEqual(rules.OPEN_REPORT_STATUSES, ["PENDING", "UNDER_REVIEW"]);
});
