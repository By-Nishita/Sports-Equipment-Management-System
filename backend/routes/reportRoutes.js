const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const r = require('../controllers/reportController');

const router = express.Router();
// Staff and admin can read. ?format=csv is checked inside the controller (admin only).
router.use(protect, authorize('staff', 'admin'));

router.get('/usage-by-type', r.usageByType);
router.get('/utilization', r.utilization);
router.get('/idle', r.idle);
router.get('/damage', r.damage);
router.get('/late', r.late);
router.get('/students', r.students);
router.get('/departments', r.departments);
router.get('/peak-hours', r.peakHours);

module.exports = router;
