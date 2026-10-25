/**
 * One-time migration: old Equipment documents -> EquipmentType + EquipmentUnit.
 *
 *   node scripts/migrateEquipmentToUnits.js --dry-run   (prints what would happen, writes nothing)
 *   node scripts/migrateEquipmentToUnits.js             (does it)
 *
 * - One type per distinct (trimmed, case-insensitive) old `name`; category and brand copied from
 *   the first item seen with that name.
 * - One unit per old item: unitCode = old equipmentId; status, condition, location,
 *   purchaseDate and price are copied.
 * - Safe to re-run: units are upserted by unitCode with $setOnInsert, so an existing unit is never
 *   overwritten and a second run only adds what is missing.
 * - Needs the OLD model at models/Equipment.js (kept until this migration is done, then deleted).
 */
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) { /* dotenv optional */ }
const mongoose = require('mongoose');
const EquipmentType = require('../models/EquipmentType');
const EquipmentUnit = require('../models/EquipmentUnit');

const STATUS_ALIASES = {
  AVAILABLE: 'AVAILABLE',
  IN_USE: 'IN_USE', INUSE: 'IN_USE', ISSUED: 'IN_USE', 'IN USE': 'IN_USE',
  RETURN_PENDING: 'RETURN_PENDING',
  DAMAGED: 'DAMAGED',
  MAINTENANCE: 'MAINTENANCE', UNDER_MAINTENANCE: 'MAINTENANCE',
  LOST: 'LOST',
  RETIRED: 'RETIRED',
};

function normalizeStatus(value) {
  const key = String(value || '').trim().toUpperCase();
  return STATUS_ALIASES[key] || null;
}

function normalizeCondition(value) {
  const key = String(value || '').trim().toUpperCase();
  return EquipmentUnit.CONDITIONS.includes(key) ? key : null;
}

async function run({ dryRun }) {
  // Loaded here so tests can import the helpers without needing the old model.
  const Equipment = require('../models/Equipment');
  const old = await Equipment.find({}).lean();

  const stats = { oldItems: old.length, typesCreated: 0, typesReused: 0, unitsCreated: 0, unitsSkipped: 0, warnings: [] };
  const typeByName = new Map(); // lower-cased name -> type doc (or a plain object in dry-run)
  const usedQr = new Set();

  async function qrFor(name) {
    const base = EquipmentType.qrFromName(name);
    let candidate = base;
    for (let i = 2; usedQr.has(candidate) || (await EquipmentType.exists({ qrIdentifier: candidate })); i += 1) {
      candidate = `${base}-${i}`;
    }
    usedQr.add(candidate);
    return candidate;
  }

  async function typeFor(item) {
    const name = String(item.name || '').trim() || 'Unnamed item';
    const key = name.toLowerCase();
    if (typeByName.has(key)) return typeByName.get(key);

    let type = await EquipmentType.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (type) {
      stats.typesReused += 1;
    } else {
      const doc = {
        name, category: item.category || '', brand: item.brand || '',
        qrIdentifier: await qrFor(name),
      };
      type = dryRun ? { _id: new mongoose.Types.ObjectId(), ...doc } : await EquipmentType.create(doc);
      stats.typesCreated += 1;
    }
    typeByName.set(key, type);
    return type;
  }

  for (const item of old) {
    const code = String(item.equipmentId || '').trim().toUpperCase();
    if (!code) {
      stats.warnings.push(`Skipped item ${item._id}: no equipmentId`);
      stats.unitsSkipped += 1;
      continue;
    }

    const status = normalizeStatus(item.status);
    if (!status) stats.warnings.push(`${code}: unknown status "${item.status}", set to AVAILABLE`);
    const condition = normalizeCondition(item.condition);
    if (!condition) stats.warnings.push(`${code}: unknown condition "${item.condition}", set to GOOD`);

    const type = await typeFor(item);
    const fields = {
      unitCode: code,
      type: type._id,
      status: status || 'AVAILABLE',
      condition: condition || 'GOOD',
      location: item.location || '',
      purchaseDate: item.purchaseDate || undefined,
      price: item.price,
    };
    Object.keys(fields).forEach((k) => fields[k] === undefined && delete fields[k]);

    if (dryRun) {
      const exists = await EquipmentUnit.exists({ unitCode: code });
      if (exists) stats.unitsSkipped += 1; else stats.unitsCreated += 1;
      continue;
    }

    const r = await EquipmentUnit.updateOne({ unitCode: code }, { $setOnInsert: fields }, { upsert: true });
    if (r.upsertedCount) stats.unitsCreated += 1; else stats.unitsSkipped += 1;
  }

  return stats;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  try {
    const stats = await run({ dryRun });
    console.log(dryRun ? 'DRY RUN (nothing written)' : 'MIGRATION DONE');
    console.log(JSON.stringify({ ...stats, warnings: undefined }, null, 2));
    if (stats.warnings.length) console.log('Warnings:\n - ' + stats.warnings.join('\n - '));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { normalizeStatus, normalizeCondition, run };
