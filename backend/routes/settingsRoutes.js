const express = require('express');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, authorize('staff', 'admin'), getSettings); // staff may read
router.put('/', protect, authorize('admin'), updateSettings);       // only admin may change

module.exports = router;