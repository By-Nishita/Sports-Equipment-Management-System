const mongoose = require('mongoose');

// ONE document holds every number the admin may want to change.
const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true }, // always 'main' => only one document can exist
  graceMinutes: { type: Number, default: 15, min: 0, max: 120 },
  defaultIssueHours: { type: Number, default: 2, min: 0.5, max: 12 },
  approvalTimeoutMinutes: { type: Number, default: 10, min: 1, max: 120 },
  maxItemsPerStudent: { type: Number, default: 3, min: 1, max: 20 },
  openingHour: { type: Number, default: 9, min: 0, max: 23 },
  closingHour: { type: Number, default: 17, min: 1, max: 24 }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);