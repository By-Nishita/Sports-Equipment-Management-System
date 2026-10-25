const express = require('express');
const { listAuditLogs } = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, authorize('admin'), listAuditLogs);
// No POST / PUT / DELETE on purpose. Only code (auditService) can write to the log.

module.exports = router;