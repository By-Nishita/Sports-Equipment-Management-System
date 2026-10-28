const express = require('express');
const { listUsers, issueTempPassword } = require('../controllers/userController');
const profile = require('../controllers/profileController');
const students = require('../controllers/studentImportController');
const uploadCsv = require('../middleware/uploadCsv');
const uploadImage = require('../middleware/uploadImage');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// ---- Everyone who is logged in: own profile (fixed words like /me come first) ----
router.get('/me/profile', protect, profile.getMine);
router.patch('/me', protect, profile.updateMine);
router.post('/me/photo', protect, uploadImage, profile.uploadMyPhoto);

// ---- Admin only ----
router.get('/', protect, authorize('admin'), listUsers);
// (/import comes before /:id)
router.post('/import/dry-run', protect, authorize('admin'), uploadCsv, students.dryRun);
router.post('/import', protect, authorize('admin'), uploadCsv, students.runImport);
router.patch('/:id', protect, authorize('admin'), students.updateUser);
router.post('/:id/temp-password', protect, authorize('admin'), issueTempPassword);

module.exports = router;
