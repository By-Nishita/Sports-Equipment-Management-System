const MAX_BULK = 500;

/** generateCodes("fb", 1, 20) -> ["FB-001", ..., "FB-020"]. Numbers pad to at least 3 digits. */
function generateCodes(prefix, from, to) {
  const p = String(prefix || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,10}$/.test(p)) throw new Error('Prefix must be 1 to 10 letters or digits');
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    throw new Error('"from" and "to" must be whole numbers with 1 <= from <= to');
  }
  if (to - from + 1 > MAX_BULK) throw new Error(`Cannot create more than ${MAX_BULK} units at once`);
  const codes = [];
  for (let n = from; n <= to; n += 1) codes.push(`${p}-${String(n).padStart(3, '0')}`);
  return codes;
}

module.exports = { generateCodes, MAX_BULK };
