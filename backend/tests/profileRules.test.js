// Unit tests for the pure profile rules. No database needed.
// Run from the backend folder:  node --test tests/profileRules.test.js
const test = require("node:test");
const assert = require("node:assert");
const rules = require("../services/profileRules");

test("cleanPhone accepts 10 to 15 digits, with or without +, spaces and dashes", () => {
  assert.strictEqual(rules.cleanPhone("9876543210"), "9876543210");
  assert.strictEqual(rules.cleanPhone(" +91 98765-43210 "), "+919876543210");
});

test("cleanPhone rejects short, long and non-numeric values", () => {
  assert.strictEqual(rules.cleanPhone("12345"), null);
  assert.strictEqual(rules.cleanPhone("1234567890123456"), null);
  assert.strictEqual(rules.cleanPhone("98765abcde"), null);
  assert.strictEqual(rules.cleanPhone(undefined), null);
  assert.strictEqual(rules.cleanPhone({ $ne: null }), null);
});

test("an empty phone is allowed (it clears the number)", () => {
  assert.strictEqual(rules.cleanPhone(""), "");
  assert.strictEqual(rules.cleanPhone("   "), "");
});

test("onTimePercent", () => {
  assert.strictEqual(rules.onTimePercent(0, 0), null);
  assert.strictEqual(rules.onTimePercent(4, 1), 75);
  assert.strictEqual(rules.onTimePercent(3, 1), 67);
  assert.strictEqual(rules.onTimePercent(5, 0), 100);
});

test("hoursFromMinutes keeps one decimal", () => {
  assert.strictEqual(rules.hoursFromMinutes(135), 2.3);
  assert.strictEqual(rules.hoursFromMinutes(0), 0);
  assert.strictEqual(rules.hoursFromMinutes(undefined), 0);
});
