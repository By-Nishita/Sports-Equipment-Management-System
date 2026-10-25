const mongoose = require('mongoose');

// Append-only diary. We only INSERT rows. There is no update or delete anywhere.
const auditLogSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // who did it (null = system)
  action: { type: String, required: true },       // e.g. 'ISSUE_APPROVED'
  entityType: { type: String, default: '' },      // e.g. 'UsageSession'
  entityId: { type: String, default: '' },        // id of that thing, stored as text
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }, // any extra details
  at: { type: Date, default: Date.now }
});

auditLogSchema.index({ at: -1 });      // fast "newest first" listing
auditLogSchema.index({ entityId: 1 }); // fast "everything that happened to this item"

module.exports = mongoose.model('AuditLog', auditLogSchema);