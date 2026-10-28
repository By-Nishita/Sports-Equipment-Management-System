// Tests of studentImportService.js with fake User/bcrypt (no MongoDB).
// Run from the backend folder:  node --test tests/studentImportService.test.js
const test = require("node:test");
const assert = require("node:assert");
const Module = require("module");

const audit = [];
let existing = [];
let bulkCalls = [];
let bulkImpl = null;

const fakes = {
  bcrypt: { hash: async () => "UNUSABLE_HASH" },
  "../models/User": {
    find: () => ({ select: () => ({ lean: async () => existing }) }),
    bulkWrite: async (ops, opts) => { bulkCalls.push({ ops, opts }); return bulkImpl ? bulkImpl(ops) : { upsertedCount: ops.length, matchedCount: 0 }; }
  },
  "./auditService": { log: async (e) => { audit.push(e); } }
};
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request in fakes) return fakes[request];
  return realLoad.call(this, request, ...rest);
};
const service = require("../services/studentImportService");

const csv = (...lines) => Buffer.from("srn,name,email,department\n" + lines.join("\n"));
const admin = { _id: "a".repeat(24) };
const reset = () => { existing = []; bulkCalls = []; bulkImpl = null; audit.length = 0; };

test("dry run counts new, existing, bad and duplicate rows and writes nothing", async () => {
  reset();
  existing = [{ srn: "OLD1", email: "o@c.edu", role: "student" }];
  const r = await service.dryRun(csv("NEW1,New One,n@c.edu,CSE", "OLD1,Old One,o@c.edu,IT", "bad,,x,", "NEW1,Again,z@c.edu,"));
  assert.strictEqual(r.totalRows, 4);
  assert.strictEqual(r.willCreate, 1);
  assert.strictEqual(r.willUpdate, 1);
  assert.strictEqual(r.invalidCount, 1);
  assert.strictEqual(r.duplicateCount, 1);
  assert.strictEqual(bulkCalls.length, 0);
});

test("a missing file or a bad file is a 400", async () => {
  await assert.rejects(service.dryRun(undefined), (e) => e.status === 400);
  await assert.rejects(service.dryRun(Buffer.from("name,email\nA,a@b.c")), (e) => e.status === 400 && /Missing column/.test(e.message));
});

test("import upserts by SRN: new students get no usable password and must change it", async () => {
  reset();
  const r = await service.runImport(admin, csv("NEW1,New One,n@c.edu,CSE"), "students.csv");
  assert.strictEqual(r.created, 1);
  const op = bulkCalls[0].ops[0].updateOne;
  assert.deepStrictEqual(op.filter, { srn: "NEW1" });
  assert.strictEqual(op.upsert, true);
  assert.deepStrictEqual(op.update.$setOnInsert, { srn: "NEW1", role: "student", isActive: true, mustChangePassword: true, password: "UNUSABLE_HASH" });
  assert.deepStrictEqual(op.update.$set, { name: "New One", email: "n@c.edu", department: "CSE" });
  assert.strictEqual(bulkCalls[0].opts.ordered, false);
});

test("an existing account is only updated: role, password and isActive are never in $set", async () => {
  reset();
  existing = [{ srn: "OLD1", email: "o@c.edu", role: "student" }];
  bulkImpl = (ops) => ({ upsertedCount: 0, matchedCount: ops.length });
  const r = await service.runImport(admin, csv("OLD1,Old One,o@c.edu,IT"), "x.csv");
  assert.strictEqual(r.updated, 1);
  const set = bulkCalls[0].ops[0].updateOne.update.$set;
  for (const key of ["role", "password", "isActive", "mustChangePassword"]) assert.ok(!(key in set));
});

test("invalid rows are skipped, the good ones are saved, and the audit row has the counts", async () => {
  reset();
  const r = await service.runImport(admin, csv("NEW1,New One,n@c.edu,", "x,,y,"), "s.csv");
  assert.strictEqual(r.created, 1);
  assert.strictEqual(r.invalidCount, 1);
  const a = audit.find((e) => e.action === "STUDENTS_IMPORTED");
  assert.deepStrictEqual({ created: a.meta.created, invalid: a.meta.invalid, file: a.meta.file }, { created: 1, invalid: 1, file: "s.csv" });
});

test("nothing valid means nothing is written", async () => {
  reset();
  await assert.rejects(service.runImport(admin, csv("x,,y,"), "s.csv"), (e) => e.status === 400 && /no valid rows/.test(e.message));
  assert.strictEqual(bulkCalls.length, 0);
});

test("rows go in batches of 500", async () => {
  reset();
  const lines = Array.from({ length: 1100 }, (_, i) => `S${100000 + i},Name ${i},s${i}@c.edu,`);
  await service.runImport(admin, csv(...lines), "big.csv");
  assert.deepStrictEqual(bulkCalls.map((c) => c.ops.length), [500, 500, 100]);
});

test("a failing batch is counted and the next batch still runs", async () => {
  reset();
  let n = 0;
  bulkImpl = (ops) => {
    if (++n === 1) { const e = new Error("boom"); e.writeErrors = [1, 2]; e.result = { upsertedCount: 498, matchedCount: 0 }; throw e; }
    return { upsertedCount: ops.length, matchedCount: 0 };
  };
  const lines = Array.from({ length: 600 }, (_, i) => `S${100000 + i},Name ${i},s${i}@c.edu,`);
  const origError = console.error; console.error = () => {};
  const r = await service.runImport(admin, csv(...lines), "big.csv");
  console.error = origError;
  assert.strictEqual(r.failed, 2);
  assert.strictEqual(r.created, 498 + 100);
});
