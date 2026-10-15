const express = require("express");
const {
    createEquipment,
    getEquipment
} = require("../controllers/equipmentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Sirf admin/staff naya equipment add kar sakte hain
router.post("/", protect, authorize("admin", "staff"), createEquipment);

// Login kiya hua koi bhi user (student included) list dekh sakta hai
router.get("/", protect, getEquipment);

router.patch("/:id", protect, authorize("admin", "staff"), updateEquipment);
router.patch("/:id/deactivate", protect, authorize("admin", "staff"), deactivateEquipment);

module.exports = router;