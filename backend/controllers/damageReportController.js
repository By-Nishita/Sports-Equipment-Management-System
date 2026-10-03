const Equipment = require("../models/Equipment");
const DamageReport = require("../models/DamageReport");

const VALID_TYPES = ["DAMAGE", "LOSS"];

// POST /api/damage-reports
// Koi bhi logged-in student/staff kisi item ki damage/loss report bhej sakta hai
const createDamageReport = async (req, res) => {
  try {
    const { equipmentId, description, type = "DAMAGE" } = req.body;

    if (!equipmentId) {
      return res.status(400).json({
        success: false,
        message: "equipmentId is required"
      });
    }

    if (!description || description.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "Please describe the problem (at least 5 characters)"
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `type must be one of: ${VALID_TYPES.join(", ")}`
      });
    }

    const equipment = await Equipment.findOne({ equipmentId });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found"
      });
    }

    // Jo item pehle se hata diya gaya ya kho chuka hai, uski report nahi
    if (["RETIRED", "LOST"].includes(equipment.status)) {
      return res.status(400).json({
        success: false,
        message: `This equipment is already marked ${equipment.status}`
      });
    }

    // Same student ki isi item pe pehle se open report ho to dobara nahi
    const alreadyReported = await DamageReport.findOne({
      equipment: equipment._id,
      reportedBy: req.user._id,
      status: { $in: ["PENDING", "UNDER_REVIEW"] }
    });

    if (alreadyReported) {
      return res.status(409).json({
        success: false,
        message: "You already have an open report for this equipment"
      });
    }

    const report = await DamageReport.create({
      equipment: equipment._id,
      reportedBy: req.user._id,
      source: "STUDENT_REPORT",
      type,
      description: description.trim()
    });

    // Item abhi free hai to use rok do taaki koi aur na le.
    // IN_USE ho to chhod do, return ke time wo khud sambhal lega.
    if (equipment.status === "AVAILABLE") {
      await Equipment.updateOne(
        { _id: equipment._id, status: "AVAILABLE" },
        type === "LOSS"
          ? { $set: { status: "LOST" } }
          : { $set: { status: "DAMAGED", condition: "DAMAGED" } }
      );
    }

    await report.populate("equipment", "equipmentId name category");

    return res.status(201).json({
      success: true,
      message: "Report submitted. Staff will review it.",
      report
    });
  } catch (error) {
    console.error("CREATE DAMAGE REPORT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET /api/damage-reports/mine
// Logged-in user ki apni reports, naye pehle
const getMyDamageReports = async (req, res) => {
  try {
    const reports = await DamageReport.find({ reportedBy: req.user._id })
      .populate("equipment", "equipmentId name category")
      .sort({ createdAt: -1 });

    return res.json({ success: true, reports });
  } catch (error) {
    console.error("GET MY DAMAGE REPORTS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  createDamageReport,
  getMyDamageReports
};