// Run from the backend folder:  node --test tests/csvParser.test.js
const test = require("node:test");
const assert = require("node:assert");
const { parseCsv } = require("../services/csvParser");

test("plain rows with Windows and Unix line ends, and a final new line", () => {
  assert.deepStrictEqual(parseCsv("a,b\r\n1,2\n3,4\n"), [["a", "b"], ["1", "2"], ["3", "4"]]);
});

test("quotes: commas, doubled quotes and new lines inside a cell", () => {
  const rows = parseCsv('name,note\n"Rao, Asha","said ""hi"""\n"Two\nLines",x\n');
  assert.deepStrictEqual(rows, [["name", "note"], ["Rao, Asha", 'said "hi"'], ["Two\nLines", "x"]]);
});

test("a BOM from Excel is ignored", () => {
  assert.deepStrictEqual(parseCsv("\uFEFFsrn,name\n1,A"), [["srn", "name"], ["1", "A"]]);
});

test("blank lines and lines with only empty cells are skipped", () => {
  assert.deepStrictEqual(parseCsv("a,b\n\n,\n1,2\n\n"), [["a", "b"], ["1", "2"]]);
});

test("semicolon files (Excel in some regions) are read too", () => {
  assert.deepStrictEqual(parseCsv("srn;name\n1;A\n"), [["srn", "name"], ["1", "A"]]);
});

test("empty cells are kept so the columns stay in place", () => {
  assert.deepStrictEqual(parseCsv("a,b,c\n1,,3"), [["a", "b", "c"], ["1", "", "3"]]);
});

test("an unclosed quote is an error, empty input gives no rows", () => {
  assert.throws(() => parseCsv('a,b\n"oops,2'), /never closed/);
  assert.deepStrictEqual(parseCsv(""), []);
  assert.deepStrictEqual(parseCsv(undefined), []);
});
