const express = require('express');
const { listUsers, issueTempPassword } = require('../controllers/userController');
const profile = require('../controllers/profileController');
const uploadImage = require('../middleware/uploadImage');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// ---- Everyone who is logged in: own profile (fixed words like /me come first) ----
router.get('/me/profile', protect, profile.getMine);
router.patch('/me', protect, profile.updateMine);
router.post('/me/photo', protect, uploadImage, profile.uploadMyPhoto);

// ---- Admin only ----
router.get('/', protect, authorize('admin'), listUsers);
router.post('/:id/temp-password', protect, authorize('admin'), issueTempPassword);

module.exports = router;
