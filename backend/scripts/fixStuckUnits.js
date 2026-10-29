// Finds and repairs units that are "in use" but nobody is using them, and finds the
// leftover database records that cause "duplicate ... id" errors when staff approve.
//
// Run from the backend folder:
//   node scripts/fixStuckUnits.js                       only SHOWS the problems, changes nothing
//   node scripts/fixStuckUnits.js --apply               frees stuck units + removes bad unique indexes
//   node scripts/fixStuckUnits.js --apply --close-conflicts
//        also closes old "ACTIVE" records whose unit is actually available (see section 4)
require('dotenv').config();
const mongoose = require('mongoose');
const UsageSession = require('../models/UsageSession');
const EquipmentUnit = require('../models/EquipmentUnit');
const { wrongIndexes } = require('./indexCompare');

const apply = process.argv.includes('--apply');
const closeConflicts = process.argv.includes('--close-conflicts');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const host = new URL(process.env.MONGO_URI.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://')).host;
  console.log(`Database host: ${host}   (${apply ? 'APPLY mode' : 'look only, nothing is changed'})\n`);

  // 1. Indexes on usagesessions that are wrong: unknown unique ones, or the right key with the wrong
  //    options (for example an old "unit_1" that is unique for every row, not only ACTIVE ones).
  const have = await UsageSession.collection.indexes();
  const badExtra = wrongIndexes(have, UsageSession.schema.indexes());
  console.log(`1. Wrong indexes: ${badExtra.length}`);
  for (const i of badExtra) console.log(`   - ${i.name}  ${JSON.stringify(i.key)}  <-- ${i.why}`);

  // 2. Old-format sessions (from before the unit system)
  const oldFormat = await UsageSession.collection.countDocuments({ type: { $exists: false } });
  console.log(`\n2. Old-format sessions (no "type" field): ${oldFormat}${oldFormat ? '   -> run: node scripts/resetOldSessions.js --confirm' : ''}`);

  // 3. Stuck units: marked in use, but no open session points at them
  const busyUnits = await EquipmentUnit.find({ status: { $in: ['IN_USE', 'RETURN_PENDING'] } }).select('unitCode status');
  const open = await UsageSession.find({ status: { $in: ['ACTIVE', 'RETURN_PENDING'] }, unit: { $ne: null } }).select('unit');
  const openUnitIds = new Set(open.map((s) => String(s.unit)));
  const stuck = busyUnits.filter((u) => !openUnitIds.has(String(u._id)));
  console.log(`\n3. Stuck units (in use, but nobody has them): ${stuck.length}`);
  for (const u of stuck) console.log(`   - ${u.unitCode} (${u.status})`);

  // 4. Open session records pointing at a unit that is marked available
  const availableIds = new Set((await EquipmentUnit.find({ status: 'AVAILABLE' }).select('_id')).map((u) => String(u._id)));
  const conflicts = (await UsageSession.find({ status: { $in: ['ACTIVE', 'RETURN_PENDING'] }, unit: { $ne: null } }).select('unit status approvedAt'))
    .filter((s) => availableIds.has(String(s.unit)));
  console.log(`\n4. Open records on units that are marked available: ${conflicts.length}`);
  for (const s of conflicts) console.log(`   - session ${s._id} (${s.status}) on unit ${s.unit}`);

  if (!apply) {
    console.log('\nNothing changed. Add --apply to fix 1 and 3 (and --close-conflicts for 4).');
  } else {
    for (const i of badExtra) { await UsageSession.collection.dropIndex(i.name); console.log(`Dropped index ${i.name}`); }
    await UsageSession.createIndexes();
    for (const u of stuck) await EquipmentUnit.updateOne({ _id: u._id, status: u.status }, { status: 'AVAILABLE' });
    console.log(`Freed ${stuck.length} stuck unit(s).`);
    if (closeConflicts && conflicts.length) {
      await UsageSession.updateMany({ _id: { $in: conflicts.map((s) => s._id) } }, { status: 'RETURNED', returnedAt: new Date() });
      console.log(`Closed ${conflicts.length} old open record(s).`);
    }
    console.log('Done.');
  }
  await mongoose.disconnect();
})().catch((err) => { console.error('Failed:', err.message); process.exit(1); });
