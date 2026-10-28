const express = require("express");
const c = require("../controllers/damageReportController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// ---- Everyone who is logged in ----
router.post("/", protect, c.create);
// (fixed words like /my must come before /:id routes)
router.get("/my", protect, c.mine);

// ---- Staff and admin: check the damage ----
router.get("/", protect, authorize("staff", "admin"), c.listAll);
router.patch("/:id/verify", protect, authorize("staff", "admin"), c.verify);

// ---- Admin only: the final decision ----
router.patch("/:id/resolve", protect, authorize("admin"), c.resolve);

module.exports = router;
