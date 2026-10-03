const express = require("express");
const {
  createDamageReport,
  getMyDamageReports
} = require("../controllers/damageReportController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// "/mine" hamesha "/:id" wale routes se upar rakho (aage ke steps mein :id aayega)
router.get("/mine", protect, getMyDamageReports);
router.post("/", protect, createDamageReport);

module.exports = router;