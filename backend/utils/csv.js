// Turns rows (array of flat objects) into CSV text.
// Cells starting with = + - @ are prefixed with ' so Excel never runs them as a formula.
function cell(value) {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(','));
  return lines.join('\r\n');
}

module.exports = { toCsv, cell };
