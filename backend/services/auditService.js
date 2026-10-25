const AuditLog = require('../models/AuditLog');

// Usage: await auditService.log({ actor: req.user._id, action: 'ISSUE_APPROVED', entityType: 'UsageSession', entityId: id, meta: {} })
// It NEVER throws: a broken diary must not break the real action (issue, return...).
async function log({ actor = null, action, entityType = '', entityId = '', meta = {} }) {
  try {
    await AuditLog.create({ actor, action, entityType, entityId: String(entityId || ''), meta });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { log };