const mongoose = require('mongoose');

const stockAuditItemSchema = new mongoose.Schema(
  {
    audit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StockAudit',
      required: true,
    },

    equipmentUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EquipmentUnit',
      default: null,
    },

    unitCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    expectedStatus: {
      type: String,
      default: null,
    },

    expectedCondition: {
      type: String,
      default: null,
    },

    verificationStatus: {
      type: String,
      enum: ['NOT_CHECKED', 'FOUND', 'UNEXPECTED', 'MISSING'],
      default: 'NOT_CHECKED',
    },

    resolution: {
      type: String,
      enum: ['SEARCH_AGAIN', 'LOST', null],
      default: null,
    },
    actualCondition: {
      type: String,
      enum: ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'],
      default: null,
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    remarks: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

stockAuditItemSchema.index(
  { audit: 1, unitCode: 1 },
  { unique: true }
);

module.exports = mongoose.model('StockAuditItem', stockAuditItemSchema);
