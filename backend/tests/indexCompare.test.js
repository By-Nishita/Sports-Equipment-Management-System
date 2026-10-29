const test = require("node:test");
const assert = require("node:assert");
const { wrongIndexes } = require("../scripts/indexCompare");

const ACTIVE = { status: "ACTIVE" };
const wanted = [
  [{ unit: 1 }, { unique: true, partialFilterExpression: ACTIVE }],
  [{ user: 1, type: 1 }, { unique: true, partialFilterExpression: { status: "ISSUE_PENDING" } }],
  [{ user: 1, createdAt: -1 }, {}],
];
const good = [
  { name: "_id_", key: { _id: 1 } },
  { name: "unit_1", key: { unit: 1 }, unique: true, partialFilterExpression: ACTIVE },
  { name: "user_1_type_1", key: { user: 1, type: 1 }, unique: true, partialFilterExpression: { status: "ISSUE_PENDING" } },
  { name: "user_1_createdAt_-1", key: { user: 1, createdAt: -1 } },
];

test("a correct database has nothing to fix", () => {
  assert.deepEqual(wrongIndexes(good, wanted), []);
});

test("old unique unit_1 without the ACTIVE filter is found (same key, wrong options)", () => {
  const have = good.map((i) => (i.name === "unit_1" ? { name: "unit_1", key: { unit: 1 }, unique: true } : i));
  const bad = wrongIndexes(have, wanted);
  assert.equal(bad.length, 1);
  assert.equal(bad[0].name, "unit_1");
});

test("a different partial filter is found", () => {
  const have = good.map((i) => (i.name === "unit_1" ? { ...i, partialFilterExpression: { status: { $in: ["ACTIVE", "RETURN_PENDING"] } } } : i));
  assert.equal(wrongIndexes(have, wanted).length, 1);
});

test("a leftover unique index on an old field is found; a leftover non-unique one is ignored", () => {
  const have = [...good, { name: "equipment_1", key: { equipment: 1 }, unique: true }, { name: "old_1", key: { old: 1 } }];
  const bad = wrongIndexes(have, wanted);
  assert.deepEqual(bad.map((b) => b.name), ["equipment_1"]);
});

test("a plain index that should be unique (or the reverse) is found", () => {
  const have = good.map((i) => (i.name === "user_1_createdAt_-1" ? { ...i, unique: true } : i));
  assert.equal(wrongIndexes(have, wanted)[0].name, "user_1_createdAt_-1");
});
