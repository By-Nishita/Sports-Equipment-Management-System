const mongoose = require('mongoose');
const EquipmentType = require('../models/EquipmentType');
const EquipmentUnit = require('../models/EquipmentUnit');
const audit = require('../services/auditService');
const { generateCodes } = require('../utils/unitCodes');
const { ok, handle, HttpError, parsePage } = require('../utils/http');

const { UNIT_STATUSES, CONDITIONS } = EquipmentUnit;
// Statuses an admin may set by hand. IN_USE and RETURN_PENDING belong to the issue/return flow (Priya).
const ADMIN_SETTABLE_STATUSES = ['AVAILABLE', 'DAMAGED', 'MAINTENANCE', 'LOST', 'RETIRED'];
const OPEN_STATUSES = ['IN_USE', 'RETURN_PENDING'];

const requireId = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, 'Invalid id');
};

async function requireActiveType(typeId) {
  requireId(typeId);
  const type = await EquipmentType.findById(typeId);
  if (!type) throw new HttpError(404, 'Equipment type not found');
  if (type.trackingMode !== 'UNIT') throw new HttpError(400, 'This type is tracked by quantity, not by unit');
  return type;
}

function cleanCommon(body) {
  const out = {};
  if (body.location !== undefined) out.location = String(body.location).trim();
  if (body.condition !== undefined) {
    if (!CONDITIONS.includes(body.condition)) throw new HttpError(400, `condition must be one of ${CONDITIONS.join(', ')}`);
    out.condition = body.condition;
  }
  if (body.price !== undefined && body.price !== null && body.price !== '') {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'price must be a non-negative number');
    out.price = price;
  }
  if (body.purchaseDate) {
    const d = new Date(body.purchaseDate);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'purchaseDate is not a valid date');
    out.purchaseDate = d;
  }
  return out;
}

// POST /api/equipment/units   (admin)  { typeId, unitCode, location, price, condition, purchaseDate }
const createUnit = handle(async (req, res) => {
  const body = req.body || {};
  const type = await requireActiveType(body.typeId);
  const unitCode = String(body.unitCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,19}$/.test(unitCode)) throw new HttpError(400, 'unitCode must look like FB-007');
  if (await EquipmentUnit.exists({ unitCode })) throw new HttpError(409, `Unit ${unitCode} already exists`);

  const unit = await EquipmentUnit.create({ ...cleanCommon(body), unitCode, type: type._id, status: 'AVAILABLE' });
  await audit.log({
    actor: req.user._id, action: 'UNIT_CREATED', entityType: 'EquipmentUnit', entityId: unit._id,
    meta: { unitCode, type: type.name },
  });
  ok(res, unit, 'Unit created', 201);
});

// POST /api/equipment/units/bulk   (admin)  { typeId, prefix, from, to, location, price }
// FB, 1..20 -> FB-001 ... FB-020. All or nothing: if any code already exists, nothing is created.
const bulkCreateUnits = handle(async (req, res) => {
  const body = req.body || {};
  const type = await requireActiveType(body.typeId);

  let codes;
  try {
    codes = generateCodes(body.prefix, Number(body.from), Number(body.to));
  } catch (e) {
    throw new HttpError(400, e.message);
  }
  const common = cleanCommon(body);

  const clashes = await EquipmentUnit.find({ unitCode: { $in: codes } }).select('unitCode').lean();
  if (clashes.length) {
    const list = clashes.slice(0, 10).map((c) => c.unitCode).join(', ');
    throw new HttpError(409, `${clashes.length} unit code(s) already exist (${list}${clashes.length > 10 ? ', ...' : ''}). Nothing was created.`);
  }

  const docs = codes.map((unitCode) => ({ ...common, unitCode, type: type._id, status: 'AVAILABLE' }));
  const created = await EquipmentUnit.insertMany(docs, { ordered: true });
  await audit.log({
    actor: req.user._id, action: 'UNITS_BULK_CREATED', entityType: 'EquipmentType', entityId: type._id,
    meta: { count: created.length, first: codes[0], last: codes[codes.length - 1] },
  });
  ok(res, { count: created.length, first: codes[0], last: codes[codes.length - 1] }, `${created.length} units created`, 201);
});

// PATCH /api/equipment/units/:id   (admin)
// Status changes are ONE atomic update that still requires the unit not to be with a student.
const updateUnit = handle(async (req, res) => {
  requireId(req.params.id);
  const body = req.body || {};
  const set = cleanCommon(body);

  const filter = { _id: req.params.id };
  if (body.status !== undefined) {
    if (!UNIT_STATUSES.includes(body.status)) throw new HttpError(400, `status must be one of ${UNIT_STATUSES.join(', ')}`);
    if (!ADMIN_SETTABLE_STATUSES.includes(body.status)) {
      throw new HttpError(400, `Status ${body.status} is set by the issue/return flow, not by hand`);
    }
    set.status = body.status;
    filter.status = { $nin: OPEN_STATUSES };
  }
  if (!Object.keys(set).length) throw new HttpError(400, 'Nothing to update');

  const before = await EquipmentUnit.findById(req.params.id).select('status').lean();
  if (!before) throw new HttpError(404, 'Unit not found');

  const unit = await EquipmentUnit.findOneAndUpdate(filter, { $set: set }, { new: true, runValidators: true });
  if (!unit) throw new HttpError(409, 'Unit is currently with a student. Confirm the return first.');

  await audit.log({
    actor: req.user._id, action: 'UNIT_UPDATED', entityType: 'EquipmentUnit', entityId: unit._id,
    meta: { unitCode: unit.unitCode, fields: Object.keys(set), from: before.status, to: unit.status },
  });
  ok(res, unit, 'Unit updated');
});

// GET /api/equipment/types/:id/units?status=&page=&limit=   (staff, admin)
const listUnitsOfType = handle(async (req, res) => {
  requireId(req.params.id);
  const { page, limit, skip } = parsePage(req.query, { limit: 100, max: 200 });
  const filter = { type: req.params.id };
  if (req.query.status) {
    if (!UNIT_STATUSES.includes(req.query.status)) throw new HttpError(400, 'Unknown status');
    filter.status = req.query.status;
  }
  const [units, total] = await Promise.all([
    EquipmentUnit.find(filter).sort({ unitCode: 1 }).skip(skip).limit(limit).lean(),
    EquipmentUnit.countDocuments(filter),
  ]);
  ok(res, units, 'OK', 200, { pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// GET /api/equipment/units/available?type=<typeId>&search=FB-0   (staff, admin)
// The approval screen's suggestion list: only AVAILABLE units of that type.
const availableUnits = handle(async (req, res) => {
  requireId(req.query.type);
  const { page, limit, skip } = parsePage(req.query, { limit: 50, max: 200 });
  const filter = { type: req.query.type, status: 'AVAILABLE' };
  if (req.query.search) {
    const esc = String(req.query.search).trim().toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.unitCode = { $regex: `^${esc}` };
  }
  const [units, total] = await Promise.all([
    EquipmentUnit.find(filter).select('unitCode condition location').sort({ unitCode: 1 }).skip(skip).limit(limit).lean(),
    EquipmentUnit.countDocuments(filter),
  ]);
  ok(res, units, 'OK', 200, { pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

module.exports = { createUnit, bulkCreateUnits, updateUnit, listUnitsOfType, availableUnits };
