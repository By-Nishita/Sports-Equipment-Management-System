const AuditLog = require('../models/AuditLog');

// Admin-only list, newest first, always paginated (this table grows large).
const listAuditLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);

    const filter = {};
    if (req.query.action) filter.action = String(req.query.action); // String() blocks {"$ne": ...} injection
    if (req.query.entityId) filter.entityId = String(req.query.entityId);
    if (req.query.from || req.query.to) {
      filter.at = {};
      if (req.query.from) filter.at.$gte = new Date(req.query.from);
      if (req.query.to) filter.at.$lte = new Date(req.query.to);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor', 'name srn role'),
      AuditLog.countDocuments(filter)
    ]);

    res.json({ success: true, logs, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('listAuditLogs error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { listAuditLogs };