// Pure helpers for reports (no database), so they are easy to test.
const { HttpError } = require('../utils/http');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;
// Dates typed by the admin ("2026-10-01") mean midnight in OUR timezone, not UTC.
const UTC_OFFSET = process.env.APP_UTC_OFFSET || '+05:30';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const round1 = (n) => Math.round(n * 10) / 10;

function startOfDay(text, label) {
  if (!DATE_RE.test(String(text || ''))) throw new HttpError(400, `"${label}" is required, like 2026-10-01`);
  // JavaScript quietly turns 2026-02-31 into March 3, so check the calendar ourselves.
  const [y, m, day] = text.split('-').map(Number);
  const check = new Date(Date.UTC(y, m - 1, day));
  const real = check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === day;
  const d = new Date(`${text}T00:00:00${UTC_OFFSET}`);
  if (!real || Number.isNaN(d.getTime())) throw new HttpError(400, `"${label}" is not a real date`);
  return d;
}

/** from and to are both required. `to` is inclusive; the returned `to` is the exclusive end. */
function parseRange(query) {
  const from = startOfDay(query.from, 'from');
  const lastDay = startOfDay(query.to, 'to');
  if (lastDay < from) throw new HttpError(400, '"to" must not be before "from"');
  const to = new Date(lastDay.getTime() + DAY_MS);
  const days = Math.round((to - from) / DAY_MS);
  if (days > MAX_RANGE_DAYS) throw new HttpError(400, `Choose a range of at most ${MAX_RANGE_DAYS} days`);
  return { from, to, days };
}

const percent = (part, whole) => (whole > 0 ? round1((part / whole) * 100) : 0);

/** Hours used / hours the units could have been used (units x opening hours x days). */
function utilizationPercent(usedMinutes, units, openHoursPerDay, days) {
  const capacityHours = units * openHoursPerDay * days;
  return { capacityHours: round1(capacityHours), percent: percent(usedMinutes / 60, capacityHours) };
}

module.exports = { parseRange, percent, utilizationPercent, round1, DAY_MS, MAX_RANGE_DAYS };
