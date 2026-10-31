const mongoose = require('mongoose');

const equipmentTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: '' },
    brand: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    imageUrl: { type: String, default: '' },
    thumbUrl: { type: String, default: '' },
    // Example: "TYPE-FOOTBALL". The QR image encodes JSON { "t": qrIdentifier }.
    qrIdentifier: { type: String, required: true, unique: true, trim: true },
    trackingMode: { type: String, enum: ['UNIT', 'QUANTITY'], default: 'UNIT' },
    // Only used when trackingMode is QUANTITY.
    stockQuantity: { type: Number, default: 0, min: 0 },
    defaultIssueHours: { type: Number, default: 2, min: 0.25 },
    isActive: { type: Boolean, default: true },
    availabilityMode: {
  type: String,
  enum: ['AVAILABLE', 'RESTRICTED', 'HIDDEN'],
  default: 'AVAILABLE'
},
  },
  { timestamps: true }
);

equipmentTypeSchema.index({ category: 1, name: 1 });

/** "Cricket Bat (Kids)" -> "TYPE-CRICKET-BAT-KIDS" */
equipmentTypeSchema.statics.qrFromName = function qrFromName(name) {
  const slug = String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `TYPE-${slug || 'ITEM'}`;
};

module.exports = mongoose.models.EquipmentType || mongoose.model('EquipmentType', equipmentTypeSchema);
