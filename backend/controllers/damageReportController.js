const mongoose = require("mongoose");
const Equipment = require("../models/Equipment");
const DamageReport = require("../models/DamageReport");

const VALID_TYPES = ["DAMAGE", "LOSS"];
const VALID_STATUSES = ["PENDING", "UNDER_REVIEW", "RESOLVED"];
const REVIEW_STATUSES = ["UNDER_REVIEW", "RESOLVED"];
const RESOLUTIONS = ["REPAIRED", "RETIRED", "LOST"];

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

// GET /api/damage-reports  (?status=PENDING)
// Sirf staff/admin (route par authorize laga hai)
const listDamageReports = async (req, res) => {
  try {
    const filter = {};
    const { status } = req.query;

    if (status !== undefined) {
      if (typeof status !== "string" || !VALID_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${VALID_STATUSES.join(", ")}`
        });
      }
      filter.status = status;
    }

    const reports = await DamageReport.find(filter)
      .populate("equipment", "equipmentId name category status condition")
      .populate("reportedBy", "name email srn")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: reports.length, reports });
  } catch (error) {
    console.error("LIST DAMAGE REPORTS ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/damage-reports/:id/review
// body: { status: "UNDER_REVIEW" | "RESOLVED", resolution?, staffNote? }
// Sirf staff/admin
const reviewDamageReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid report id" });
    }

    const { status, resolution, staffNote } = req.body;

    if (typeof status !== "string" || !REVIEW_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${REVIEW_STATUSES.join(", ")}`
      });
    }

    if (staffNote !== undefined && typeof staffNote !== "string") {
      return res.status(400).json({ success: false, message: "staffNote must be text" });
    }

    if (status === "RESOLVED" && !RESOLUTIONS.includes(resolution)) {
      return res.status(400).json({
        success: false,
        message: `To resolve, resolution must be one of: ${RESOLUTIONS.join(", ")}`
      });
    }

    const report = await DamageReport.findById(id);

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const equipment = await Equipment.findById(report.equipment);

    if (!equipment) {
      return res.status(404).json({ success: false, message: "Equipment of this report not found" });
    }

    // Item abhi kisi ke paas hai to uska status mat chhedo, return ke baad resolve karo
    if (status === "RESOLVED" && equipment.status === "IN_USE") {
      return res.status(409).json({
        success: false,
        message: "This item is currently issued to someone. Resolve the report after it is returned."
      });
    }

    const changes = {
      status,
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    };

    const note = typeof staffNote === "string" ? staffNote.trim().slice(0, 1000) : "";
    if (note) changes.staffNote = note;
    if (status === "RESOLVED") changes.resolution = resolution;

    // Check aur change ek hi step mein: report abhi bhi sahi halat mein ho tabhi badlo.
    // UNDER_REVIEW sirf PENDING se; RESOLVED PENDING ya UNDER_REVIEW se.
    const allowedFrom = status === "UNDER_REVIEW" ? ["PENDING"] : ["PENDING", "UNDER_REVIEW"];

    const updated = await DamageReport.findOneAndUpdate(
      { _id: id, status: { $in: allowedFrom } },
      { $set: changes },
      { new: true }
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: "This report was already reviewed. Refresh the list."
      });
    }

    // Ab item ka status report ke saath match karo
    let equipmentNote = "";

    if (status === "UNDER_REVIEW") {
      await Equipment.updateOne(
        { _id: equipment._id, status: "DAMAGED" },
        { $set: { status: "MAINTENANCE" } }
      );
    } else if (resolution === "REPAIRED") {
      // Isi item ki koi aur open report ho to item abhi free nahi hoga
      const otherOpen = await DamageReport.exists({
        equipment: equipment._id,
        _id: { $ne: updated._id },
        status: { $in: ["PENDING", "UNDER_REVIEW"] }
      });

      if (otherOpen) {
        equipmentNote = " Item stays out of use: another report on it is still open.";
      } else {
        await Equipment.updateOne(
          { _id: equipment._id, status: { $in: ["DAMAGED", "MAINTENANCE"] } },
          { $set: { status: "AVAILABLE", condition: "GOOD" } }
        );
      }
    } else {
      await Equipment.updateOne(
        { _id: equipment._id, status: { $ne: "IN_USE" } },
        { $set: { status: resolution === "LOST" ? "LOST" : "RETIRED" } }
      );
    }

    const latest = await Equipment.findById(equipment._id).select("status");

    await updated.populate([
      { path: "equipment", select: "equipmentId name category status condition" },
      { path: "reportedBy", select: "name email srn" },
      { path: "reviewedBy", select: "name" }
    ]);

    return res.json({
      success: true,
      message:
        (status === "UNDER_REVIEW" ? "Moved to Under review." : "Report resolved.") + equipmentNote,
      report: updated,
      equipmentStatus: latest.status
    });
  } catch (error) {
    console.error("REVIEW DAMAGE REPORT ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createDamageReport,
  getMyDamageReports,
  listDamageReports,
  reviewDamageReport
};