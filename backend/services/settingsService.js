const Settings = require('../models/Settings');

// Returns the one settings document. If it doesn't exist yet, create it with defaults.
// upsert + $setOnInsert is atomic: even if two requests arrive together, only one document is made.
async function get() {
  return Settings.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

// Only these fields can be changed through the API.
const EDITABLE = [
  'graceMinutes', 'defaultIssueHours', 'approvalTimeoutMinutes',
  'maxItemsPerStudent', 'openingHour', 'closingHour'
];

async function update(changes) {
  const doc = await get();
  EDITABLE.forEach((field) => {
    if (changes[field] !== undefined) doc[field] = Number(changes[field]);
  });
  if (doc.closingHour <= doc.openingHour) {
    const err = new Error('Closing hour must be after opening hour');
    err.status = 400;
    throw err;
  }
  await doc.save(); // the min/max rules from the model run here
  return doc;
}

module.exports = { get, update, EDITABLE };