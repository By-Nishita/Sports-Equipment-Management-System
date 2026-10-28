const express = require("express");

const {
  createEquipment,
  getEquipment,
  updateEquipment,
  deactivateEquipment,
  reactivateEquipment
} = require("../controllers/equipmentController");

const {
  listTypes,
  getType,
  getTypeByQr,
  createType,
  updateType
} = require("../controllers/typeController");

const {
  createUnit,
  bulkCreateUnits,
  updateUnit,
  listUnitsOfType,
  availableUnits
} = require("../controllers/unitController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// --------------------------------------------------
// EXISTING EQUIPMENT ROUTES
// --------------------------------------------------

// Only admin can create equipment.
router.post("/", protect, authorize("admin"), createEquipment);

// Logged-in users can view equipment.
router.get("/", protect, getEquipment);

// Only admin can update equipment.
router.patch("/:id", protect, authorize("admin"), updateEquipment);

// Only admin can deactivate equipment.
router.patch(
  "/:id/deactivate",
  protect,
  authorize("admin"),
  deactivateEquipment
);

// Only admin can reactivate retired equipment.
router.patch(
  "/:id/reactivate",
  protect,
  authorize("admin"),
  reactivateEquipment
);

// --------------------------------------------------
// EQUIPMENT TYPE ROUTES
// --------------------------------------------------

// Logged-in users can view equipment types.
router.get("/types", protect, listTypes);
router.get("/types/by-qr/:qr", protect, getTypeByQr);
router.get("/types/:id", protect, getType);

// Only admin can manage equipment types.
router.post("/types", protect, authorize("admin"), createType);
router.patch("/types/:id", protect, authorize("admin"), updateType);

// --------------------------------------------------
// EQUIPMENT UNIT ROUTES
// --------------------------------------------------

// Staff and admins can view units belonging to a type.
router.get(
  "/types/:id/units",
  protect,
  authorize("staff", "admin"),
  listUnitsOfType
);

// Staff and admins can view available units.
router.get(
  "/units/available",
  protect,
  authorize("staff", "admin"),
  availableUnits
);

// Only admin can create or update units.
router.post("/units", protect, authorize("admin"), createUnit);
router.post("/units/bulk", protect, authorize("admin"), bulkCreateUnits);
router.patch("/units/:id", protect, authorize("admin"), updateUnit);

module.exports = router;