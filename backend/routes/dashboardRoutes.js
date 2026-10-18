const express = require("express");
const { getDashboardStats } = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// protect = must be logged in, authorize = only staff or admin
router.get("/stats", protect, authorize("staff", "admin"), getDashboardStats);

module.exports = router;