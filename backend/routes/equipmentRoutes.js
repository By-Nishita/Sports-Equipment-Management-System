const express = require("express");
const {
    createEquipment,
    getEquipment,
    updateEquipment,
    deactivateEquipment
} = require("../controllers/equipmentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Only admin can add equipment
router.post("/", protect, authorize("admin"), createEquipment);

// Logged-in users can view equipment
router.get("/", protect, getEquipment);

// Only admin can edit or deactivate equipment
router.patch("/:id", protect, authorize("admin"), updateEquipment);
router.patch("/:id/deactivate", protect, authorize("admin"), deactivateEquipment);

module.exports = router;

const { reactivateEquipment } = require('../controllers/equipmentController');
router.patch('/:id/reactivate', protect, authorize('admin'), reactivateEquipment);
