const mongoose = require('mongoose');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const EquipmentUnit = require('../models/EquipmentUnit');
const audit = require('../services/auditService');
const { ok, handle, HttpError, parsePage } = require('../utils/http');

// GET /api/maintenance?unit=<unitId>&page=1&limit=50
const listMaintenance = handle(async (req, res) => {
  const { page, limit, skip } = parsePage(req.query, { limit: 50, max: 200 });
  const filter = {};

  if (req.query.unit) {
    if (!mongoose.isValidObjectId(req.query.unit)) {
      throw new HttpError(400, 'Invalid unit id');
    }
    filter.unit = req.query.unit;
  }

  const [records, total] = await Promise.all([
    MaintenanceRecord.find(filter)
      .populate('unit', 'unitCode status type')
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MaintenanceRecord.countDocuments(filter)
  ]);

  ok(res, records, 'OK', 200, {
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  });
});

// POST /api/maintenance { unit, description }
const createMaintenance = handle(async (req, res) => {
  const unitId = String(req.body?.unit || '');
  const description = String(req.body?.description || '').trim();

  if (!mongoose.isValidObjectId(unitId)) {
    throw new HttpError(400, 'Select a valid equipment unit');
  }
  if (!description) {
    throw new HttpError(400, 'Maintenance details are required');
  }
  if (description.length > 2000) {
    throw new HttpError(400, 'Maintenance details must be 2000 characters or fewer');
  }

  const unit = await EquipmentUnit.findById(unitId);
  if (!unit) throw new HttpError(404, 'Equipment unit not found');
  if (unit.status === 'IN_USE' || unit.status === 'RETURN_PENDING') {
    throw new HttpError(409, 'This unit is currently with a student. Confirm its return first.');
  }
  if (unit.status === 'RETIRED') {
    throw new HttpError(400, 'Retired units cannot be sent for maintenance');
  }

  const record = await MaintenanceRecord.create({
    unit: unit._id,
    description,
    createdBy: req.user._id
  });

  // Mark the unit unavailable while maintenance is open.
  unit.status = 'MAINTENANCE';
  await unit.save();

  await audit.log({
    actor: req.user._id,
    action: 'MAINTENANCE_CREATED',
    entityType: 'MaintenanceRecord',
    entityId: record._id,
    meta: { unitCode: unit.unitCode }
  });

  const populated = await MaintenanceRecord.findById(record._id)
    .populate('unit', 'unitCode status type')
    .populate('createdBy', 'name role');

  ok(res, populated, 'Maintenance record created', 201);
});

module.exports = { listMaintenance, createMaintenance };
