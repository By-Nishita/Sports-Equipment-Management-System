const express = require("express");
const c = require("../controllers/sessionController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();
const staffOrAdmin = authorize("staff", "admin");

// ---- Student side (any logged-in user) ----
router.post("/request-issue", protect, c.requestIssue);
router.post("/request-return", protect, c.requestReturn);
router.post("/:id/cancel", protect, c.cancel);
router.get("/my", protect, c.mySessions);

// ---- Staff side ----
// (fixed words like /pending-approvals must come before /:id routes)
router.get("/pending-approvals", protect, staffOrAdmin, c.pendingApprovals);
router.get("/pending-returns", protect, staffOrAdmin, c.pendingReturns);
router.get("/active", protect, staffOrAdmin, c.activeSessions);
router.get("/overdue", protect, staffOrAdmin, c.overdueSessions);
router.post("/:id/approve", protect, staffOrAdmin, c.approve);
router.post("/:id/reject", protect, staffOrAdmin, c.reject);
router.post("/:id/confirm-return", protect, staffOrAdmin, c.confirmReturn);
router.post("/:id/flag-mismatch", protect, staffOrAdmin, c.flagMismatch);

module.exports = router;