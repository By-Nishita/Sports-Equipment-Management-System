const crypto = require("crypto");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const auditService = require("./auditService");
const rules = require("./studentImportRules");
const { HttpError } = require("../utils/http");

const BATCH = 500;
const SHOW_LIMIT = 100; // the reply lists at most this many bad rows (the count is always exact)

// Reads the file and compares it with the database. Changes nothing.
async function analyze(buffer) {
  if (!buffer || !buffer.length) throw new HttpError(400, 'Upload a CSV file in the "file" field');

  const csv = rules.analyzeCsv(buffer.toString("utf8"));
  if (csv.fileError) throw new HttpError(400, csv.fileError);

  const srns = csv.rows.map((r) => r.srn);
  const emails = csv.rows.map((r) => r.email);
  const existing = csv.rows.length
    ? await User.find({ $or: [{ srn: { $in: srns } }, { email: { $in: emails } }] }).select("srn email role").lean()
    : [];

  const split = rules.splitByExisting(csv.rows, existing);
  return {
    totalRows: csv.totalRows,
    toCreate: split.toCreate,
    toUpdate: split.toUpdate,
    invalid: [...csv.invalid, ...split.invalid].sort((a, b) => a.line - b.line),
    duplicates: csv.duplicates
  };
}

const summary = (a) => ({
  totalRows: a.totalRows,
  valid: a.toCreate.length + a.toUpdate.length,
  willCreate: a.toCreate.length,
  willUpdate: a.toUpdate.length,
  invalidCount: a.invalid.length,
  invalid: a.invalid.slice(0, SHOW_LIMIT),
  duplicateCount: a.duplicates.length,
  duplicates: a.duplicates.slice(0, SHOW_LIMIT)
});

// POST /users/import/dry-run
async function dryRun(buffer) {
  return summary(await analyze(buffer));
}

// POST /users/import. The file is checked again here: nothing from the dry run is trusted.
async function runImport(admin, buffer, filename) {
  const a = await analyze(buffer);
  const good = [...a.toCreate, ...a.toUpdate];
  if (good.length === 0) throw new HttpError(400, "There are no valid rows to import");

  // New students get an unusable random password. They set their own through "Forgot password".
  const unusable = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

  let created = 0;
  let updated = 0;
  let failed = 0;
  for (let i = 0; i < good.length; i += BATCH) {
    const ops = good.slice(i, i + BATCH).map((row) => ({
      updateOne: {
        filter: { srn: row.srn },
        update: {
          $set: rules.detailsOf(row),
          $setOnInsert: { srn: row.srn, role: "student", isActive: true, mustChangePassword: true, password: unusable }
        },
        upsert: true
      }
    }));
    try {
      const res = await User.bulkWrite(ops, { ordered: false });
      created += res.upsertedCount || 0;
      updated += (res.matchedCount || 0);
    } catch (err) {
      // some rows may still have been written; count them and carry on with the next batch
      const r = err.result || {};
      created += r.upsertedCount || (r.getUpsertedIds ? r.getUpsertedIds().length : 0) || 0;
      updated += r.matchedCount || 0;
      failed += (err.writeErrors || []).length || ops.length;
      console.error("Student import batch error:", err.message);
    }
  }

  await auditService.log({
    actor: admin._id,
    action: "STUDENTS_IMPORTED",
    entityType: "User",
    meta: { file: String(filename || "").slice(0, 100), created, updated, failed, invalid: a.invalid.length, duplicates: a.duplicates.length }
  });

  return { created, updated, failed, invalidCount: a.invalid.length, duplicateCount: a.duplicates.length };
}

module.exports = { dryRun, runImport };
