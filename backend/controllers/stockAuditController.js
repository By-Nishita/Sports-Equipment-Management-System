const mongoose = require('mongoose');
const StockAudit = require('../models/StockAudit');
const StockAuditItem = require('../models/StockAuditItem');
const EquipmentUnit = require('../models/EquipmentUnit');
const { log } = require('../services/auditService');

const isAdmin = (req) =>
  ['admin', 'staff'].includes(req.user?.role?.toLowerCase());

const startAudit = async (req, res) => {
  try {
    if (req.user.role.toLowerCase() !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Audit name is required' });
    }

    const units = await EquipmentUnit.find({
      status: { $nin: ['LOST', 'RETIRED'] },
    }).lean();

    const audit = await StockAudit.create({
      name,
      startedBy: req.user._id,
    });

    if (units.length) {
      await StockAuditItem.insertMany(
        units.map((unit) => ({
          audit: audit._id,
          equipmentUnit: unit._id,
          unitCode: unit.unitCode,
          expectedStatus: unit.status,
          expectedCondition: unit.condition,
        }))
      );
    }

    await log({
      actor: req.user._id,
      action: 'STOCK_AUDIT_STARTED',
      entityType: 'StockAudit',
      entityId: audit._id,
      meta: { name, units: units.length },
    });

    res.status(201).json({
      message: 'Stock audit started',
      audit,
      totalUnits: units.length,
    });
  } catch (error) {
    console.error('STOCK AUDIT ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const listAudits = async (req, res) => {
  try {
    const audits = await StockAudit.find()
      .populate('startedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(audits);
  } catch (error) {
    console.error('STOCK AUDIT ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getAudit = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid audit ID' });
    }

    const audit = await StockAudit.findById(req.params.id)
      .populate('startedBy', 'name email');

    if (!audit) return res.status(404).json({ message: 'Audit not found' });

    const items = await StockAuditItem.find({ audit: audit._id })
      .populate('equipmentUnit');

    res.json({ audit, items });
  } catch (error) {
    console.error('STOCK AUDIT ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const scanUnit = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid audit ID' });
    }

    const audit = await StockAudit.findById(req.params.id);
    if (!audit) return res.status(404).json({ message: 'Audit not found' });
    if (audit.status !== 'IN_PROGRESS') {
      return res.status(400).json({ message: 'Audit is already completed' });
    }

    const unitCode = String(req.body.unitCode || '').trim().toUpperCase();
    if (!unitCode) {
      return res.status(400).json({ message: 'Unit code is required' });
    }

    const unit = await EquipmentUnit.findOne({ unitCode });
    let item = await StockAuditItem.findOne({ audit: audit._id, unitCode });

    if (!item) {
      item = await StockAuditItem.create({
        audit: audit._id,
        equipmentUnit: unit?._id || null,
        unitCode,
        expectedStatus: unit?.status || null,
        expectedCondition: unit?.condition || null,
        verificationStatus: 'UNEXPECTED',
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        actualCondition: req.body.actualCondition || null,
        remarks: req.body.remarks === undefined ? '' : String(req.body.remarks).trim(),
      });
    } else {
      if (item.verificationStatus !== 'UNEXPECTED') {
        item.verificationStatus = 'FOUND';
      }

      item.verifiedBy = req.user._id;
      item.verifiedAt = new Date();

      if (req.body.actualCondition) {
        item.actualCondition = req.body.actualCondition;
      }

      if (req.body.remarks !== undefined) {
        item.remarks = String(req.body.remarks).trim();
      }

      await item.save();
    }

    res.json({ message: 'Unit scanned', item });
  } catch (error) {
    console.error('STOCK AUDIT ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};const closeAudit = async (req, res) => {
  try {
    if (req.user.role.toLowerCase() !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid audit ID' });
    }

    const audit = await StockAudit.findById(req.params.id);
    if (!audit) return res.status(404).json({ message: 'Audit not found' });

    if (audit.status !== 'IN_PROGRESS') {
      return res.status(400).json({ message: 'Audit is already completed' });
    }

    const items = await StockAuditItem.find({ audit: audit._id });
    const unchecked = items.filter((item) => item.verificationStatus === 'NOT_CHECKED');
    const resolutions = Array.isArray(req.body.resolutions) ? req.body.resolutions : [];
    const resolutionMap = new Map(
      resolutions.map((entry) => [
        String(entry.unitCode || '').trim().toUpperCase(),
        String(entry.resolution || '').trim().toUpperCase(),
      ])
    );

    const unresolved = unchecked.filter((item) => {
      const resolution = resolutionMap.get(item.unitCode);
      return !['SEARCH_AGAIN', 'LOST'].includes(resolution);
    });

    if (unresolved.length) {
      return res.status(400).json({
        message: 'Choose SEARCH_AGAIN or LOST for every unchecked unit.',
        units: unresolved.map((item) => item.unitCode),
      });
    }

    for (const item of unchecked) {
      const resolution = resolutionMap.get(item.unitCode);

      item.verificationStatus = 'MISSING';
      item.resolution = resolution;
      await item.save();

      if (resolution === 'LOST' && item.equipmentUnit) {
        await EquipmentUnit.updateOne(
          { _id: item.equipmentUnit },
          { $set: { status: 'LOST' } }
        );

        await log({
          actor: req.user._id,
          action: 'STOCK_UNIT_MARKED_LOST',
          entityType: 'EquipmentUnit',
          entityId: item.equipmentUnit,
          meta: { unitCode: item.unitCode, auditId: audit._id },
        });
      }
    }

    audit.status = 'COMPLETED';
    audit.completedAt = new Date();
    audit.completedBy = req.user._id;
    await audit.save();

    await log({
      actor: req.user._id,
      action: 'STOCK_AUDIT_COMPLETED',
      entityType: 'StockAudit',
      entityId: audit._id,
      meta: {
        totalUnits: items.length,
        missingUnits: unchecked.length,
      },
    });

    res.json({ message: 'Stock audit completed', audit });
  } catch (error) {
    console.error('STOCK AUDIT ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};const getAuditReport = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid audit ID' });
    }

    const audit = await StockAudit.findById(req.params.id);
    if (!audit) return res.status(404).json({ message: 'Audit not found' });

    const items = await StockAuditItem.find({ audit: audit._id }).lean();

    res.json({
      audit,
      summary: {
        total: items.length,
        found: items.filter((i) => i.verificationStatus === 'FOUND').length,
        missing: items.filter((i) => i.verificationStatus === 'MISSING').length,
        unexpected: items.filter((i) => i.verificationStatus === 'UNEXPECTED').length,
        damaged: items.filter(
          (i) => i.actualCondition === 'DAMAGED' ||
            i.expectedStatus === 'DAMAGED'
        ).length,
        maintenance: items.filter(
          (i) => i.expectedStatus === 'MAINTENANCE'
        ).length,
      },
      items,
    });
  } catch (error) {
    console.error('STOCK AUDIT ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  startAudit,
  listAudits,
  getAudit,
  scanUnit,
  closeAudit,
  getAuditReport,
};