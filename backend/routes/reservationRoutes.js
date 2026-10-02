const express = require("express");

const router = express.Router();

const {
  createReservation,
  getMyReservations,
  cancelReservation
} = require("../controllers/reservationController");

const { protect } = require("../middleware/authMiddleware");

// Create reservation
router.post("/", protect, createReservation);

// Get my reservations
router.get("/mine", protect, getMyReservations);

// Cancel reservation
router.post("/:id/cancel", protect, cancelReservation);

module.exports = router;