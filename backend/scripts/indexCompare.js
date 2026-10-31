// Pure helper (no database): which existing indexes differ from what the code wants?
// Mongoose creates an index only if no index with the same NAME exists. So an old, wrong
// "unit_1" (unique on every row, not only ACTIVE ones) stays forever and later makes
// "approve" fail with a duplicate-key error. Comparing only the key misses that case.

const same = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

/**
 * @param have   result of collection.indexes()  [{ name, key, unique, partialFilterExpression }]
 * @param wanted result of schema.indexes()      [[fields, options], ...]
 * @returns indexes that must be dropped: [{ name, key, why }]
 */
function wrongIndexes(have, wanted) {
  const byKey = new Map(wanted.map(([fields, options]) => [JSON.stringify(fields), options || {}]));
  const bad = [];
  for (const idx of have) {
    if (idx.name === '_id_') continue;
    const want = byKey.get(JSON.stringify(idx.key));
    if (!want) {
      if (idx.unique) bad.push({ name: idx.name, key: idx.key, why: 'unique index the code does not define' });
      continue;
    }
    if (!!idx.unique !== !!want.unique) {
      bad.push({ name: idx.name, key: idx.key, why: want.unique ? 'should be unique' : 'is unique but should not be' });
    } else if (!same(idx.partialFilterExpression, want.partialFilterExpression)) {
      bad.push({ name: idx.name, key: idx.key, why: 'unique on too many rows (partial filter is missing or different)' });
    }
  }
  return bad;
}

module.exports = { wrongIndexes };
