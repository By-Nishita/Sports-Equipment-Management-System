// Run from the backend folder:  node --test tests/studentImportRules.test.js
const test = require("node:test");
const assert = require("node:assert");
const rules = require("../services/studentImportRules");

const HEAD = "SRN,Name,Email,Department,Program,Division,Year\n";

test("good rows are read; SRN is upper-cased and email lower-cased", () => {
  const r = rules.analyzeCsv(HEAD + "31240071,Asha Rao, Asha@College.EDU ,CSE,B.Tech,A,2\n");
  assert.strictEqual(r.rows.length, 1);
  assert.strictEqual(r.rows[0].email, "asha@college.edu");
  assert.strictEqual(r.rows[0].division, "A");
  assert.strictEqual(r.rows[0].line, 2);
  assert.strictEqual(rules.analyzeCsv("srn,name,email\nab12cd,Ben Cole,b@c.edu").rows[0].srn, "AB12CD");
});

test("header names are matched loosely and the optional columns can be missing", () => {
  const r = rules.analyzeCsv("Student Name,S.R.N,Email ID\nBen Cole,31240072,ben@college.edu");
  assert.strictEqual(r.fileError, undefined);
  assert.strictEqual(r.rows[0].name, "Ben Cole");
});

test("a file without the required columns is refused with the column names", () => {
  assert.match(rules.analyzeCsv("name,email\nA,a@b.c").fileError, /Missing column: SRN/);
  assert.match(rules.analyzeCsv("").fileError, /empty/);
  assert.match(rules.analyzeCsv("srn,name,email\n").fileError, /no students/);
});

test("bad rows are listed with the line number and every reason", () => {
  const r = rules.analyzeCsv(HEAD + "12,A,not-an-email,,,,\n31240073,,x@y.zz,,,,\n31240074,Good Name,g@c.edu,,,,\n");
  assert.strictEqual(r.rows.length, 1);
  assert.deepStrictEqual(r.invalid.map((x) => x.line), [2, 3]);
  assert.ok(r.invalid[0].errors.some((e) => /SRN must be/.test(e)));
  assert.ok(r.invalid[0].errors.some((e) => /Email is not valid/.test(e)));
  assert.ok(r.invalid[1].errors.some((e) => /Name is required/.test(e)));
});

test("the same SRN or email twice in the file: the first stays, the rest are duplicates", () => {
  const r = rules.analyzeCsv(HEAD + "31240071,A One,a@c.edu,,,,\n31240071,A Two,z@c.edu,,,,\n31240075,A Three,A@C.EDU,,,,\n");
  assert.strictEqual(r.rows.length, 1);
  assert.deepStrictEqual(r.duplicates.map((d) => d.line), [3, 4]);
  assert.match(r.duplicates[0].reason, /Same SRN as line 2/);
  assert.match(r.duplicates[1].reason, /Same email as line 2/);
});

test("too many rows are refused", () => {
  const big = HEAD + Array.from({ length: rules.MAX_ROWS + 1 }, (_, i) => `S${100000 + i},N${i} x,s${i}@c.edu`).join("\n");
  assert.match(rules.analyzeCsv(big).fileError, /more than 5000/);
});

test("splitByExisting: new, update, staff SRN, email owned by someone else", () => {
  const rows = [
    { line: 2, srn: "NEW1", email: "n1@c.edu" },
    { line: 3, srn: "OLD1", email: "o1@c.edu" },
    { line: 4, srn: "STAFF1", email: "s1@c.edu" },
    { line: 5, srn: "NEW2", email: "taken@c.edu" }
  ];
  const existing = [
    { srn: "OLD1", email: "old1@c.edu", role: "student" },
    { srn: "STAFF1", email: "s1@c.edu", role: "staff" },
    { srn: "OTHER", email: "taken@c.edu", role: "student" }
  ];
  const r = rules.splitByExisting(rows, existing);
  assert.deepStrictEqual(r.toCreate.map((x) => x.srn), ["NEW1"]);
  assert.deepStrictEqual(r.toUpdate.map((x) => x.srn), ["OLD1"]);
  assert.deepStrictEqual(r.invalid.map((x) => x.line), [4, 5]);
});

test("detailsOf never erases an optional field with an empty cell", () => {
  assert.deepStrictEqual(
    rules.detailsOf({ name: "A", email: "a@c.edu", department: "", program: "B.Tech", division: "", year: "2" }),
    { name: "A", email: "a@c.edu", program: "B.Tech", year: "2" }
  );
});
