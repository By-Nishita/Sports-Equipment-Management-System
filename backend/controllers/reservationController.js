const mongoose = require("mongoose");
const { Equipment, Reservation, UsageSession } = require("../models");
const { validateSlot } = require("../services/reservationRules");
const {
  expireStaleReservations,
  buildOverlapQuery
} = require("../services/reservationService");

// Create a slot-based reservation
// Body: { equipmentId, startTime, endTime }  (ISO-8601 with time zone)
const createReservation = async (req, res) => {
  try {
    const { equipmentId, startTime: startRaw, endTime: endRaw } = req.body;

    // Check equipment ID
    if (!equipmentId) {
      return res.status(400).json({
        message: "Equipment ID is required"
      });
    }

    const now = new Date();

    // Validate the slot (duration, 7-day limit, not in the past ...)
    const slot = validateSlot(startRaw, endRaw, now);

    if (!slot.ok) {
      return res.status(400).json({ message: slot.message });
    }

    const { startTime, endTime, expiresAt } = slot;

    // Find equipment
    const equipment = await Equipment.findOne({ equipmentId });

    if (!equipment) {
      return res.status(404).json({
        message: "Equipment not found"
      });
    }

    // Reservation never changes equipment status. We only check that the
    // equipment can possibly be free at the requested time.
    if (equipment.status === "IN_USE") {
      // Allowed only if the current issue is due back before the slot starts
      const activeSession = await UsageSession.findOne({
        equipment: equipment._id,
        status: "ACTIVE"
      });

      if (activeSession && activeSession.dueAt > startTime) {
        return res.status(400).json({
          message:
            "Equipment is currently in use and is not due back before the requested slot"
        });
      }
    } else if (equipment.status !== "AVAILABLE") {
      return res.status(400).json({
        message: `Equipment cannot be reserved (current status: ${equipment.status})`
      });
    }

    // Free the equipment from reservations nobody claimed in time
    await expireStaleReservations({ equipment: equipment._id }, now);

    // Reject if another reservation overlaps this slot
    const conflict = await Reservation.findOne(
      buildOverlapQuery(equipment._id, startTime, endTime)
    );

    if (conflict) {
      return res.status(409).json({
        message: "This equipment is already reserved for an overlapping time slot"
      });
    }

    // Create reservation (equipment status is NOT changed)
    const reservation = await Reservation.create({
      equipment: equipment._id,
      user: req.user._id,
      status: "ACTIVE",
      startTime,
      endTime,
      expiresAt
    });

    // Two requests can pass the check above at the same moment.
    // Re-check: if an overlapping reservation with a SMALLER _id exists,
    // this request loses and removes its own new record. The smaller _id
    // always wins, so exactly one of the competing requests survives.
    const earlierConflict = await Reservation.findOne({
      ...buildOverlapQuery(equipment._id, startTime, endTime),
      _id: { $lt: reservation._id }
    });

    if (earlierConflict) {
      await Reservation.deleteOne({ _id: reservation._id });

      return res.status(409).json({
        message: "This equipment is already reserved for an overlapping time slot"
      });
    }

    return res.status(201).json({
      message: "Equipment reserved successfully",
      reservation
    });

  } catch (error) {
    console.error("Create reservation error:", error);

    // Only happens while the OLD unique index still exists in the database
    if (error.code === 11000) {
      console.error(
        "Old reservation index is still in the database. " +
        "See backend/scripts/dropOldReservationIndex.js"
      );

      return res.status(409).json({
        message: "Equipment is already reserved"
      });
    }

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// Get current user's reservations
const getMyReservations = async (req, res) => {
  try {
    const now = new Date();

    // Mark unclaimed reservations as NO_SHOW / EXPIRED
    await expireStaleReservations({ user: req.user._id }, now);

    // Get user's reservations
    const reservations = await Reservation.find({
      user: req.user._id
    })
      .populate("equipment")
      .sort({ createdAt: -1 });

    return res.json(reservations);

  } catch (error) {
    console.error("Get reservations error:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// Cancel a reservation
const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid reservation ID"
      });
    }

    // If its claim deadline already passed, it is NO_SHOW and not cancellable
    await expireStaleReservations({ _id: id });

    // Find reservation
    const reservation = await Reservation.findById(id);

    if (!reservation) {
      return res.status(404).json({
        message: "Reservation not found"
      });
    }

    // Check whether current user owns reservation
    const isOwner =
      reservation.user.toString() === req.user._id.toString();

    // Staff/admin can also cancel
    const isStaffOrAdmin =
      req.user.role === "staff" ||
      req.user.role === "admin";

    if (!isOwner && !isStaffOrAdmin) {
      return res.status(403).json({
        message: "Not authorized"
      });
    }

    // Only ACTIVE reservations can be cancelled
    if (reservation.status !== "ACTIVE") {
      return res.status(400).json({
        message: "Reservation is not active"
      });
    }

    // Cancel reservation
    reservation.status = "CANCELLED";
    reservation.cancelledAt = new Date();

    await reservation.save();

    return res.json({
      message: "Reservation cancelled successfully",
      reservation
    });

  } catch (error) {
    console.error("Cancel reservation error:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


module.exports = {
  createReservation,
  getMyReservations,
  cancelReservation
};