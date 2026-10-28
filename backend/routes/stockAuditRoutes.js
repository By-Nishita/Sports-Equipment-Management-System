const express = require('express');

const {
  startAudit,
  listAudits,
  getAudit,
  scanUnit,
  closeAudit,
  getAuditReport,
} = require('../controllers/stockAuditController');

const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', authorize('admin', 'staff'), listAudits);
router.post('/', authorize('admin'), startAudit);
router.get('/:id/report', authorize('admin', 'staff'), getAuditReport);
router.post('/:id/scan', authorize('admin', 'staff'), scanUnit);
router.post('/:id/close', authorize('admin'), closeAudit);
router.get('/:id', authorize('admin', 'staff'), getAudit);

module.exports = router;