const express = require("express");
const { issueEquipment, returnEquipment } = require("../controllers/sessionController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/issue", protect, issueEquipment);
router.post("/return", protect, returnEquipment);

module.exports = router;