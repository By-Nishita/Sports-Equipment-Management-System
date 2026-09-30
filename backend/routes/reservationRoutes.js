const express = require("express");

const {
    createReservation,
    getReservations,
    getMyReservations
} = require("../controllers/reservationController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createReservation);

router.get("/", protect, getReservations);

router.get("/my", protect, getMyReservations);

module.exports = router;