const mongoose = require('mongoose');

// Shared contract (section 3.1). There is no ISSUE_PENDING status on a unit.
const UNIT_STATUSES = ['AVAILABLE', 'IN_USE', 'RETURN_PENDING', 'DAMAGED', 'MAINTENANCE', 'LOST', 'RETIRED'];
const CONDITIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'];

const equipmentUnitSchema = new mongoose.Schema(
  {
    unitCode: { type: String, required: true, unique: true, trim: true, uppercase: true }, // e.g. "FB-007"
    type: { type: mongoose.Schema.Types.ObjectId, ref: 'EquipmentType', required: true },
    status: { type: String, enum: UNIT_STATUSES, default: 'AVAILABLE' },
    condition: { type: String, enum: CONDITIONS, default: 'GOOD' },
    location: { type: String, trim: true, default: '' },
    purchaseDate: { type: Date },
    price: { type: Number, min: 0 },
  },
  { timestamps: true }
);

equipmentUnitSchema.index({ type: 1, status: 1 });

module.exports = mongoose.models.EquipmentUnit || mongoose.model('EquipmentUnit', equipmentUnitSchema);
module.exports.UNIT_STATUSES = UNIT_STATUSES;
module.exports.CONDITIONS = CONDITIONS;
