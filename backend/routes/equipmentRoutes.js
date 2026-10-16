const express = require("express");
const {
    createEquipment,
    getEquipment,
    updateEquipment,
    deactivateEquipment
} = require("../controllers/equipmentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin/staff can add equipment
router.post("/", protect, authorize("admin", "staff"), createEquipment);

// Logged-in users can view equipment
router.get("/", protect, getEquipment);

// Admin/staff can edit or deactivate equipment
router.patch("/:id", protect, authorize("admin", "staff"), updateEquipment);
router.patch("/:id/deactivate", protect, authorize("admin", "staff"), deactivateEquipment);

module.exports = router;

const { reactivateEquipment } = require('../controllers/equipmentController');
router.patch('/:id/reactivate', protect, authorize('admin', 'staff'), reactivateEquipment);
