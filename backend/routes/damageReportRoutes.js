const express = require("express");
const {
  createDamageReport,
  getMyDamageReports,
  listDamageReports,
  reviewDamageReport
} = require("../controllers/damageReportController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// "/mine" hamesha "/:id" wale routes se upar rakho (aage ke steps mein :id aayega)
router.get("/mine", protect, getMyDamageReports);
router.get("/", protect, authorize("staff", "admin"), listDamageReports);
router.patch("/:id/review", protect, authorize("staff", "admin"), reviewDamageReport);
router.post("/", protect, createDamageReport);

module.exports = router;