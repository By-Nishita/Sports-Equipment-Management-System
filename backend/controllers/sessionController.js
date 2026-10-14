const Equipment = require("../models/Equipment");
const UsageSession = require("../models/UsageSession");
const Reservation = require("../models/Reservation");
const DamageReport = require("../models/DamageReport");
const {
  expireStaleReservations,
  findStartedActiveReservation,
  getBlockingReservation
} = require("../services/reservationService");
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

    const now = new Date();

    // Mark unclaimed reservations as NO_SHOW / EXPIRED
    await expireStaleReservations({}, now);

    // Check whether equipment exists
    const existingEquipment = await Equipment.findOne({ equipmentId });

    if (!existingEquipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found"
      });
    }

    // Equipment must be AVAILABLE
    if (existingEquipment.status !== "AVAILABLE") {
      return res.status(400).json({
        success: false,
        message: `Equipment is not available (current status: ${existingEquipment.status})`
      });
    }

    // N2: Check whether another student blocks this equipment.
    // A future reservation does not block issuing it right now.
    const { blockedByOther } = await getBlockingReservation(
      existingEquipment._id,
      req.user._id,
      now
    );

    if (blockedByOther) {
      return res.status(403).json({
        success: false,
        message: "This equipment is reserved by another student"
      });
    }

    // Atomically change AVAILABLE -> IN_USE
    const equipment = await Equipment.findOneAndUpdate(
      {
        equipmentId,
        status: "AVAILABLE"
      },
      {
        status: "IN_USE"
      },
      {
        new: true
      }
    );

    if (!equipment) {
      return res.status(400).json({
        success: false,
        message: "Equipment is no longer available"
      });
    }

    // N2: Check again after claiming, to reduce race-condition risk.
    const afterClaimNow = new Date();

    const { blockedByOther: blockedAfterClaim } =
      await getBlockingReservation(
        equipment._id,
        req.user._id,
        afterClaimNow
      );

    if (blockedAfterClaim) {
      await Equipment.updateOne(
        { _id: equipment._id },
        { status: "AVAILABLE" }
      );

      return res.status(403).json({
        success: false,
        message: "This equipment is reserved by another student"
      });
    }

    // Find this user's reservation, if one applies right now.
    const reservationAfterClaim = await Reservation.findOne({
      equipment: equipment._id,
      user: req.user._id,
      status: "ACTIVE",
      expiresAt: { $gt: afterClaimNow },
      $or: [
        { startTime: null },
        { startTime: { $lte: afterClaimNow } }
      ]
    });

    // Keep existing issue duration unchanged.
    const dueAt = new Date(
      Date.now() + DEFAULT_ISSUE_HOURS * 60 * 60 * 1000
    );

    try {
      const issuedVia = reservationAfterClaim
        ? "RESERVATION"
        : "DIRECT";

      // Create usage session
      const session = await UsageSession.create({
        equipment: equipment._id,
        user: req.user._id,
        dueAt,
        reservation: reservationAfterClaim
          ? reservationAfterClaim._id
          : null,
        issuedVia
      });

      // If reservation was used, mark it as fulfilled
      if (reservationAfterClaim) {
        reservationAfterClaim.status = "FULFILLED";
        reservationAfterClaim.fulfilledAt = new Date();
        reservationAfterClaim.session = session._id;

        await reservationAfterClaim.save();
      }

      await session.populate(
        "equipment",
        "equipmentId name category"
      );

      return res.status(201).json({
        success: true,
        message: reservationAfterClaim
          ? "Equipment issued successfully using reservation"
          : "Equipment issued successfully",
        session
      });

    } catch (err) {
      // If session creation fails, make equipment available again.
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

    // Only the student who issued it or staff/admin can return it
    const isOwner =
      session.user.toString() === req.user._id.toString();

    const isStaff =
      ["admin", "staff"].includes(req.user.role);

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
    
    // Check ACTIVE again so double return does not happen
    const updatedSession = await UsageSession.findOneAndUpdate(
      {
        _id: session._id,
        status: "ACTIVE"
      },
      {
        status: "RETURNED",
        returnedAt,
        durationMinutes,
        returnCondition: condition,
        conditionBefore,
        wasLate,
        lateMinutes
      },
      {
        new: true
      }
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
      { $set: { status: isDamaged ? "DAMAGED" : "AVAILABLE", condition } }
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
            typeof description === "string" ? description.trim().slice(0, 1000) : "";

          await DamageReport.create({
            equipment: equipment._id,
            reportedBy: req.user._id,
            session: updatedSession._id,
            source: "RETURN",
            type: "DAMAGE",
            description: note || "Marked damaged when returned (no details given)"
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