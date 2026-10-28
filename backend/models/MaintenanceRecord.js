const mongoose = require('mongoose');

const maintenanceRecordSchema = new mongoose.Schema({
  unit: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EquipmentUnit',
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED'],
    default: 'OPEN'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  completedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.models.MaintenanceRecord ||
  mongoose.model('MaintenanceRecord', maintenanceRecordSchema);
