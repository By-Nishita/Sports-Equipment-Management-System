// ONE-TIME script for your development database.
// The old DamageReport pointed at "equipment". The new one points at "unit".
// Old reports do not fit the new screens, so they are removed.
//
// Run from the backend folder:
//   node scripts/resetOldDamageReports.js            (only shows what it would do)
//   node scripts/resetOldDamageReports.js --confirm  (really does it)
require("dotenv").config();
const mongoose = require("mongoose");
const DamageReport = require("../models/DamageReport");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const old = await DamageReport.collection.countDocuments({ unit: { $in: [null] } });
  console.log(`Old-format damage reports found: ${old}`);

  if (process.argv.includes("--confirm")) {
    await DamageReport.collection.deleteMany({ unit: { $in: [null] } });
    await DamageReport.syncIndexes();
    console.log("Deleted old damage reports and synced indexes. Done.");
  } else {
    console.log("Nothing changed. Add --confirm to delete them.");
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
