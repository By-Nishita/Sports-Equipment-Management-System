const mongoose = require("mongoose");
const { Equipment, Reservation } = require("../models");

// Create a reservation
const createReservation = async (req, res) => {
  try {
    const { equipmentId } = req.body;

    // Check equipment ID
    if (!equipmentId) {
      return res.status(400).json({
        message: "Equipment ID is required"
      });
    }

    // Find equipment
    const equipment = await Equipment.findOne({ equipmentId });

    if (!equipment) {
      return res.status(404).json({
        message: "Equipment not found"
      });
    }

    // Equipment must be available
    if (equipment.status !== "AVAILABLE") {
      return res.status(400).json({
        message: "Equipment is not available for reservation"
      });
    }

    const now = new Date();

    // Expire user's old reservations
    await Reservation.updateMany(
      {
        user: req.user._id,
        status: "ACTIVE",
        expiresAt: { $lte: now }
      },
      {
        $set: {
          status: "EXPIRED"
        }
      }
    );

    // One active reservation per student
    const existingUserReservation = await Reservation.findOne({
      user: req.user._id,
      status: "ACTIVE",
      expiresAt: { $gt: now }
    });

    if (existingUserReservation) {
      return res.status(400).json({
        message: "You already have an active reservation"
      });
    }

    // Expire old reservation for this equipment
    await Reservation.updateMany(
      {
        equipment: equipment._id,
        status: "ACTIVE",
        expiresAt: { $lte: now }
      },
      {
        $set: {
          status: "EXPIRED"
        }
      }
    );

    // Reservation valid for 30 minutes
    const expiresAt = new Date(
      Date.now() + 30 * 60 * 1000
    );

    // Create reservation
    const reservation = await Reservation.create({
      equipment: equipment._id,
      user: req.user._id,
      status: "ACTIVE",
      expiresAt
    });

    return res.status(201).json({
      message: "Equipment reserved successfully",
      reservation
    });

  } catch (error) {
    console.error("Create reservation error:", error);

    // Duplicate active reservation
    if (error.code === 11000) {
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

    // Mark expired reservations
    await Reservation.updateMany(
      {
        user: req.user._id,
        status: "ACTIVE",
        expiresAt: { $lte: now }
      },
      {
        $set: {
          status: "EXPIRED"
        }
      }
    );

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