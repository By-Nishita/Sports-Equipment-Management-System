const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const uploadImage = require('../middleware/uploadImage');
const types = require('../controllers/typeController');
const units = require('../controllers/unitController');
const { uploadPhoto } = require('../controllers/typePhotoController');

const router = express.Router();
router.use(protect);

const staffOrAdmin = authorize('staff', 'admin');
const adminOnly = authorize('admin');

// ---- Types ----
// Order matters: /types/by-qr/:qr must come before /types/:id.
router.get('/types', types.listTypes);                       // all roles
router.get('/types/by-qr/:qr', types.getTypeByQr);           // all roles
router.get('/types/:id', types.getType);                     // all roles
router.post('/types', adminOnly, types.createType);
router.patch('/types/:id', adminOnly, types.updateType);
router.post('/types/:id/photo', adminOnly, uploadImage, uploadPhoto);
router.get('/types/:id/units', staffOrAdmin, units.listUnitsOfType);

// ---- Units ----
// /units/available and /units/bulk must come before /units/:id.
router.get('/units/available', staffOrAdmin, units.availableUnits);
router.post('/units/bulk', adminOnly, units.bulkCreateUnits);
router.post('/units', adminOnly, units.createUnit);
router.patch('/units/:id', adminOnly, units.updateUnit);

module.exports = router;
