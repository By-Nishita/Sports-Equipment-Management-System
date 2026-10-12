const express = require("express");
const { issueEquipment, returnEquipment } = require("../controllers/sessionController");
const { protect,authorize } = require("../middleware/authMiddleware");
const { getActiveSessions, getOverdueSessions, getMySessions} = require("../controllers/sessionReportController");
const router = express.Router();

router.post("/issue", protect, issueEquipment);
router.post("/return", protect, returnEquipment);
router.get("/active", protect, authorize("staff", "admin"), getActiveSessions);
router.get("/overdue", protect, authorize("staff", "admin"), getOverdueSessions);
router.get("/my", protect, getMySessions);

module.exports = router;