const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const controller = require('../controllers/maintenanceController');

const router = express.Router();

router.use(protect, authorize('admin'));
router.get('/', controller.listMaintenance);
router.post('/', controller.createMaintenance);

module.exports = router;
