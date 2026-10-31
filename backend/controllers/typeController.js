const mongoose = require('mongoose');
const EquipmentType = require('../models/EquipmentType');
const EquipmentUnit = require('../models/EquipmentUnit');
const audit = require('../services/auditService');
const { ok, handle, HttpError, parsePage } = require('../utils/http');

const EDITABLE_FIELDS = [
  'name', 'category', 'brand', 'description',
  'trackingMode', 'stockQuantity', 'defaultIssueHours', 'isActive',
'availabilityMode',
];

/**
 * Counts are NEVER stored. One aggregation on equipmentUnits grouped by type and status.
 * total (usable) = every unit except RETIRED and LOST.
 * For QUANTITY types the number comes from stockQuantity instead.
 */
async function countsForTypes(types) {
  const ids = types.map((t) => t._id);
  const rows = ids.length
    ? await EquipmentUnit.aggregate([
        { $match: { type: { $in: ids } } },
        { $group: { _id: { type: '$type', status: '$status' }, n: { $sum: 1 } } },
      ])
    : [];

  const byType = new Map();
  for (const r of rows) {
    const key = String(r._id.type);
    if (!byType.has(key)) byType.set(key, {});
    byType.get(key)[r._id.status] = r.n;
  }

  const result = new Map();
  for (const t of types) {
    if (t.trackingMode === 'QUANTITY') {
      result.set(String(t._id), {
        total: t.stockQuantity, available: t.stockQuantity, inUse: 0, damaged: 0,
      });
      continue;
    }
    const s = byType.get(String(t._id)) || {};
    const all = Object.values(s).reduce((a, b) => a + b, 0);
    result.set(String(t._id), {
      total: all - (s.RETIRED || 0) - (s.LOST || 0),
      available: s.AVAILABLE || 0,
      inUse: (s.IN_USE || 0) + (s.RETURN_PENDING || 0),
      damaged: s.DAMAGED || 0,
    });
  }
  return result;
}

const withCounts = (type, counts) => ({ ...type.toObject(), counts: counts.get(String(type._id)) });

const isAdmin = (req) => req.user && req.user.role === 'admin';

function pickEditable(body) {
  const out = {};
  for (const f of EDITABLE_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  if (out.name !== undefined) {
    out.name = String(out.name).trim();
    if (!out.name) throw new HttpError(400, 'Name is required');
  }
  if (out.trackingMode !== undefined && !['UNIT', 'QUANTITY'].includes(out.trackingMode)) {
    throw new HttpError(400, 'trackingMode must be UNIT or QUANTITY');
  }
  if (out.availabilityMode !== undefined &&
    !['AVAILABLE', 'RESTRICTED', 'HIDDEN'].includes(out.availabilityMode)) {
  throw new HttpError(400, 'Invalid availability mode');
}
  for (const f of ['stockQuantity', 'defaultIssueHours']) {
    if (out[f] !== undefined && (!Number.isFinite(Number(out[f])) || Number(out[f]) < 0)) {
      throw new HttpError(400, `${f} must be a non-negative number`);
    }
    if (out[f] !== undefined) out[f] = Number(out[f]);
  }
  return out;
}

/** TYPE-<SLUG>, with -2, -3 ... when the slug is already taken. */
async function uniqueQr(name) {
  const base = EquipmentType.qrFromName(name);
  let candidate = base;
  for (let i = 2; await EquipmentType.exists({ qrIdentifier: candidate }); i += 1) {
    candidate = `${base}-${i}`;
  }
  return candidate;
}

// GET /api/equipment/types?search=&category=&page=&limit=   (all roles)
const listTypes = handle(async (req, res) => {
  const { page, limit, skip } = parsePage(req.query);
  const filter = {};
  if (!isAdmin(req)) {
  filter.isActive = true;
  filter.availabilityMode = { $ne: 'HIDDEN' };
}
  else if (req.query.active === 'true') filter.isActive = true;
  else if (req.query.active === 'false') filter.isActive = false;
  if (req.query.category) filter.category = String(req.query.category);
  if (req.query.search) {
    const esc = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.name = { $regex: esc, $options: 'i' };
  }

  const [types, total] = await Promise.all([
    EquipmentType.find(filter).sort({ category: 1, name: 1 }).skip(skip).limit(limit),
    EquipmentType.countDocuments(filter),
  ]);
  const counts = await countsForTypes(types);
  ok(res, types.map((t) => withCounts(t, counts)), 'OK', 200, {
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

async function loadType(req, filter) {
  const type = await EquipmentType.findOne(filter);
  if (!type || (!type.isActive && !isAdmin(req))) throw new HttpError(404, 'Equipment type not found');
  return type;
}

// GET /api/equipment/types/:id   (all roles)
const getType = handle(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
  const type = await loadType(req, { _id: req.params.id });
  const counts = await countsForTypes([type]);
  ok(res, withCounts(type, counts));
});

// GET /api/equipment/types/by-qr/:qr   (all roles) - the scan screen calls this
const getTypeByQr = handle(async (req, res) => {
  const qr = String(req.params.qr || '').trim().toUpperCase();
  const type = await loadType(req, { qrIdentifier: qr });
  const counts = await countsForTypes([type]);
  ok(res, withCounts(type, counts));
});

// POST /api/equipment/types   (admin)
const createType = handle(async (req, res) => {
  const fields = pickEditable(req.body || {});
  if (!fields.name) throw new HttpError(400, 'Name is required');
  const type = await EquipmentType.create({ ...fields, qrIdentifier: await uniqueQr(fields.name) });
  await audit.log({
    actor: req.user._id, action: 'TYPE_CREATED', entityType: 'EquipmentType', entityId: type._id,
    meta: { name: type.name, qrIdentifier: type.qrIdentifier },
  });
  ok(res, type, 'Equipment type created', 201);
});

// PATCH /api/equipment/types/:id   (admin). qrIdentifier is never edited: stickers are already printed.
const updateType = handle(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
  const fields = pickEditable(req.body || {});
  if (!Object.keys(fields).length) throw new HttpError(400, 'Nothing to update');
  const type = await EquipmentType.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true });
  if (!type) throw new HttpError(404, 'Equipment type not found');
  await audit.log({
    actor: req.user._id, action: 'TYPE_UPDATED', entityType: 'EquipmentType', entityId: type._id,
    meta: { fields: Object.keys(fields) },
  });
  ok(res, type, 'Equipment type updated');
});

module.exports = { listTypes, getType, getTypeByQr, createType, updateType, countsForTypes, uniqueQr };
