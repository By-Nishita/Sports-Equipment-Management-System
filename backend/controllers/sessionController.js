const Equipment = require("../models/Equipment");
const UsageSession = require("../models/UsageSession");
const DamageReport = require("../models/DamageReport");

const DEFAULT_ISSUE_HOURS = 2;

const issueEquipment = async (req, res) => {
  try {
    const { equipmentId } = req.body;

    if (!equipmentId) {
      return res.status(400).json({
        success: false,
        message: "equipmentId is required"
      });
    }

    const existingEquipment = await Equipment.findOne({ equipmentId });

    if (!existingEquipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found"
      });
    }

    if (existingEquipment.status !== "AVAILABLE") {
      return res.status(400).json({
        success: false,
        message: `Equipment is not available (current status: ${existingEquipment.status})`
      });
    }

    // Atomically change AVAILABLE -> IN_USE
    const equipment = await Equipment.findOneAndUpdate(
      { equipmentId, status: "AVAILABLE" },
      { status: "IN_USE" },
      { new: true }
    );

    if (!equipment) {
      return res.status(400).json({
        success: false,
        message: "Equipment is no longer available"
      });
    }

    const dueAt = new Date(
      Date.now() + DEFAULT_ISSUE_HOURS * 60 * 60 * 1000
    );

    try {
      const session = await UsageSession.create({
        equipment: equipment._id,
        user: req.user._id,
        dueAt
      });

      await session.populate("equipment", "equipmentId name category");

      return res.status(201).json({
        success: true,
        message: "Equipment issued successfully",
        session
      });
    } catch (err) {
      // Restore availability if session creation fails.
      await Equipment.updateOne(
        { _id: equipment._id },
        { status: "AVAILABLE" }
      );
      throw err;
    }
  } catch (error) {
    console.error("ISSUE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const VALID_CONDITIONS = [
  "EXCELLENT",
  "GOOD",
  "FAIR",
  "DAMAGED"
];

const returnEquipment = async (req, res) => {
  try {
    const { equipmentId, condition, description } = req.body;

    if (!equipmentId || !condition) {
      return res.status(400).json({
        success: false,
        message: "equipmentId and condition are required"
      });
    }

    if (!VALID_CONDITIONS.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: `condition must be one of: ${VALID_CONDITIONS.join(", ")}`
      });
    }

    const equipment = await Equipment.findOne({ equipmentId });

    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found"
      });
    }

    const session = await UsageSession.findOne({
      equipment: equipment._id,
      status: "ACTIVE"
    });

    if (!session) {
      return res.status(400).json({
        success: false,
        message: "This equipment is not currently issued"
      });
    }

    const isOwner =
      session.user.toString() === req.user._id.toString();

    const isStaff = ["admin", "staff"].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        message: "You did not issue this equipment"
      });
    }

    const returnedAt = new Date();

    const durationMinutes = Math.round(
      (returnedAt - session.issuedAt) / 60000
    );

    const lateMs = returnedAt - session.dueAt;
    const lateMinutes = lateMs > 0 ? Math.ceil(lateMs / 60000) : 0;
    const wasLate = lateMinutes > 0;
    const conditionBefore = equipment.condition;

    const updatedSession = await UsageSession.findOneAndUpdate(
      { _id: session._id, status: "ACTIVE" },
      {
        status: "RETURNED",
        returnedAt,
        durationMinutes,
        returnCondition: condition,
        conditionBefore,
        wasLate,
        lateMinutes
      },
      { new: true }
    );

    if (!updatedSession) {
      return res.status(409).json({
        success: false,
        message: "Already returned"
      });
    }

    const isDamaged = condition === "DAMAGED";

    await Equipment.updateOne(
      { _id: equipment._id, status: "IN_USE" },
      {
        $set: {
          status: isDamaged ? "DAMAGED" : "AVAILABLE",
          condition
        }
      }
    );

    let reportCreated = false;

    if (isDamaged) {
      try {
        const alreadyOpen = await DamageReport.exists({
          equipment: equipment._id,
          status: { $in: ["PENDING", "UNDER_REVIEW"] }
        });

        if (!alreadyOpen) {
          const note =
            typeof description === "string"
              ? description.trim().slice(0, 1000)
              : "";

          await DamageReport.create({
            equipment: equipment._id,
            reportedBy: req.user._id,
            session: updatedSession._id,
            source: "RETURN",
            type: "DAMAGE",
            description:
              note || "Marked damaged when returned (no details given)"
          });

          reportCreated = true;
        }
      } catch (reportError) {
        console.error("AUTO DAMAGE REPORT ERROR:", reportError);
      }
    }

    const latest = await Equipment.findById(equipment._id).select("status");

    return res.json({
      success: true,
      message: isDamaged
        ? "Returned. Equipment marked as damaged and sent to staff for review"
        : "Equipment returned successfully",
      session: updatedSession,
      equipmentStatus: latest.status,
      damageReportCreated: reportCreated
    });
  } catch (error) {
    console.error("RETURN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = {
  issueEquipment,
  returnEquipment
};