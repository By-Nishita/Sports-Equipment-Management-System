const mongoose = require('mongoose');

const usageSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  equipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  duration: { type: Number },
  status: { type: String, enum: ['ACTIVE', 'COMPLETED'], default: 'ACTIVE' },
  conditionBefore: { type: String, enum: ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'] },
  conditionAfter: { type: String, enum: ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'] }
}, { timestamps: true });

module.exports = mongoose.model('UsageSession', usageSessionSchema);
