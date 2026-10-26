// ONE-TIME script for your development database.
// The old UsageSession had "equipment / issuedAt". The new one has "type / unit / requestedAt".
// Old rows do not fit, and the old unique index on "equipment" would block new sessions.
//
// Run from the backend folder:
//   node scripts/resetOldSessions.js            (only shows what it would do)
//   node scripts/resetOldSessions.js --confirm  (really does it)
require("dotenv").config();
const mongoose = require("mongoose");
const UsageSession = require("../models/UsageSession");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const old = await UsageSession.collection.countDocuments({ type: { $exists: false } });
  console.log(`Old-format sessions found: ${old}`);

  if (process.argv.includes("--confirm")) {
    await UsageSession.collection.deleteMany({ type: { $exists: false } });
    // Makes the database indexes match the new model (drops the old "equipment" index).
    await UsageSession.syncIndexes();
    console.log("Deleted old sessions and synced indexes. Done.");
  } else {
    console.log("Nothing changed. Add --confirm to delete them and fix the indexes.");
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
