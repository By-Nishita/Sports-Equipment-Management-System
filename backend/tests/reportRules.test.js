// Unit tests for report helpers. No database needed.
// Run from the backend folder:  node --test tests/reportRules.test.js
const test = require('node:test');
const assert = require('node:assert');
const { parseRange, percent, utilizationPercent } = require('../services/reportRules');
const { toCsv } = require('../utils/csv');

test('from and to are required', () => {
  assert.throws(() => parseRange({}), /"from" is required/);
  assert.throws(() => parseRange({ from: '2026-10-01' }), /"to" is required/);
});

test('bad or impossible dates are rejected', () => {
  assert.throws(() => parseRange({ from: '01-10-2026', to: '2026-10-05' }), /"from"/);
  assert.throws(() => parseRange({ from: '2026-02-31', to: '2026-03-05' }), /not a real date/);
});

test('to before from is rejected', () => {
  assert.throws(() => parseRange({ from: '2026-10-10', to: '2026-10-01' }), /not be before/);
});

test('range longer than 366 days is rejected', () => {
  assert.throws(() => parseRange({ from: '2025-01-01', to: '2026-10-01' }), /at most 366/);
  assert.doesNotThrow(() => parseRange({ from: '2026-01-01', to: '2026-12-31' }));
});

test('the "to" day is included (end is the start of the next day)', () => {
  const r = parseRange({ from: '2026-10-01', to: '2026-10-01' });
  assert.strictEqual(r.days, 1);
  assert.strictEqual(r.to.getTime() - r.from.getTime(), 24 * 60 * 60 * 1000);
});

test('percent never divides by zero', () => {
  assert.strictEqual(percent(1, 0), 0);
  assert.strictEqual(percent(1, 3), 33.3);
});

test('utilization = used hours / (units x opening hours x days)', () => {
  // 5 units x 8 open hours x 10 days = 400 h capacity; 100 h used = 25 %
  assert.deepStrictEqual(utilizationPercent(100 * 60, 5, 8, 10), { capacityHours: 400, percent: 25 });
  assert.strictEqual(utilizationPercent(60, 0, 8, 10).percent, 0);
});

test('csv quotes commas and quotes, and blocks spreadsheet formulas', () => {
  const csv = toCsv([{ name: 'Bat, "kids"', note: '=SUM(A1)', n: 3, when: null }]);
  assert.strictEqual(csv, 'name,note,n,when\r\n"Bat, ""kids""",\'=SUM(A1),3,');
  assert.strictEqual(toCsv([]), '');
});
