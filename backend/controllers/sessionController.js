const Equipment = require("../models/Equipment");
const UsageSession = require("../models/UsageSession");
const Reservation = require("../models/Reservation");

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

    // Expire old reservations
    await Reservation.updateMany(
      {
        status: "ACTIVE",
        expiresAt: { $lte: now }
      },
      {
        $set: {
          status: "EXPIRED"
        }
      }
    );

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

    // Check active reservation for this equipment
    const activeReservation = await Reservation.findOne({
      equipment: existingEquipment._id,
      status: "ACTIVE",
      expiresAt: { $gt: now }
    });

    // If reserved by another student, reject
    if (
      activeReservation &&
      activeReservation.user.toString() !== req.user._id.toString()
    ) {
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

    // Check reservation again after claiming the equipment
    const reservationAfterClaim = await Reservation.findOne({
      equipment: equipment._id,
      status: "ACTIVE",
      expiresAt: { $gt: new Date() }
    });

    // If another student reserved it during the process,
    // rollback the equipment status
    if (
      reservationAfterClaim &&
      reservationAfterClaim.user.toString() !== req.user._id.toString()
    ) {
      await Equipment.updateOne(
        { _id: equipment._id },
        { status: "AVAILABLE" }
      );

      return res.status(403).json({
        success: false,
        message: "This equipment is reserved by another student"
      });
    }

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
      // If session creation fails,
      // make equipment available again
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
    const { equipmentId, condition } = req.body;

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
        returnCondition: condition
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

    equipment.condition = condition;

    equipment.status =
      condition === "DAMAGED"
        ? "DAMAGED"
        : "AVAILABLE";

    await equipment.save();

    return res.json({
      success: true,
      message:
        condition === "DAMAGED"
          ? "Returned. Equipment marked as damaged and needs staff review"
          : "Equipment returned successfully",
      session: updatedSession,
      equipmentStatus: equipment.status
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