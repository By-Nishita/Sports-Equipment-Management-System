// backend/scripts/dropOldReservationIndex.js
//
// One-time migration for N1 (slot-based reservations).
//
// The old Reservation model had a UNIQUE index that allowed only one
// ACTIVE reservation per equipment. Slot booking needs several reservations
// for the same equipment (different times), so that index must be removed
// from the database. Removing it from the schema file does NOT remove it
// from an existing database.
//
// What it does NOT do: it never deletes or edits any reservation document.
// It only drops that one index (the old reservations stay exactly as they are).
//
// Usage (from the backend folder):
//   node scripts/dropOldReservationIndex.js            -> dry run, changes nothing
//   node scripts/dropOldReservationIndex.js --confirm  -> actually drops the index

require("dotenv").config();
const mongoose = require("mongoose");
const { Reservation } = require("../models");

const confirm = process.argv.includes("--confirm");

const isOldIndex = (idx) =>
  idx.unique === true &&
  Object.keys(idx.key).length === 1 &&
  idx.key.equipment === 1 &&
  idx.partialFilterExpression &&
  idx.partialFilterExpression.status === "ACTIVE";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to:", mongoose.connection.name);

  const indexes = await Reservation.collection.indexes();
  console.log("Current indexes:", indexes.map((i) => i.name).join(", "));

  const old = indexes.filter(isOldIndex);

  if (old.length === 0) {
    console.log("Old unique index not found. Nothing to do.");
  }

  for (const idx of old) {
    if (!confirm) {
      console.log(`DRY RUN: would drop index "${idx.name}". Re-run with --confirm.`);
      continue;
    }

    await Reservation.collection.dropIndex(idx.name);
    console.log(`Dropped index "${idx.name}".`);
  }

  if (confirm) {
    // Create the new (non-unique) indexes defined in the schema
    await Reservation.createIndexes();
    console.log("New indexes ensured.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
