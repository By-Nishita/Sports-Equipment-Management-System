const mongoose = require('mongoose');

const damageReportSchema = new mongoose.Schema({
  equipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, required: true },
  image: { type: String },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['REPORTED', 'REVIEWED', 'RESOLVED'], default: 'REPORTED' }
}, { timestamps: true });

module.exports = mongoose.model('DamageReport', damageReportSchema);
