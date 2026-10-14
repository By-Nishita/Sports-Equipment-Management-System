// backend/services/reservationService.js
//
// Database helpers for slot-based reservations (N1).
//
// Meaning of the fields:
//   startTime / endTime : the booked slot (new reservations always have them)
//   expiresAt           : claim deadline = startTime + 15 minutes
//                         (old 30-minute-hold reservations: createdAt + 30 min)

const mongoose = require("mongoose");
const { Reservation } = require("../models");
const getBlockingReservation = async (equipmentId, userId, now = new Date()) => {
  // Validate input
  if (
    !mongoose.Types.ObjectId.isValid(equipmentId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    const error = new Error("Invalid equipment ID or user ID");
    error.statusCode = 400;
    throw error;
  }

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    const error = new Error("Invalid current time");
    error.statusCode = 400;
    throw error;
  }

  // Check whether another student has a reservation active right now
  const blockingReservation = await Reservation.findOne({
    equipment: equipmentId,
    user: { $ne: userId },
    status: "ACTIVE",
    expiresAt: { $gt: now },
    $or: [
      { startTime: null },
      { startTime: { $lte: now } }
    ]
  });

  // Find the earliest upcoming active booking
  const nextReservation = await Reservation.findOne({
    equipment: equipmentId,
    status: "ACTIVE",
    startTime: { $gt: now },
    expiresAt: { $gt: now }
  })
    .sort({ startTime: 1 })
    .select("startTime");

  return {
    blockedByOther: Boolean(blockingReservation),
    nextBookingStart: nextReservation ? nextReservation.startTime : null
  };
};

// Lazy expiration (no background job):
//  - a slot reservation nobody claimed by its deadline becomes NO_SHOW
//  - an old 30-minute hold (no startTime) becomes EXPIRED, as before
// Pass a filter ({ user }, { equipment }, { _id }) to limit the work.
const expireStaleReservations = async (filter = {}, now = new Date()) => {
  await Reservation.updateMany(
    {
      ...filter,
      status: "ACTIVE",
      expiresAt: { $lte: now },
      startTime: { $ne: null }
    },
    { $set: { status: "NO_SHOW" } }
  );

  await Reservation.updateMany(
    {
      ...filter,
      status: "ACTIVE",
      expiresAt: { $lte: now },
      startTime: null
    },
    { $set: { status: "EXPIRED" } }
  );
};

// Query for reservations of one equipment that overlap [start, end).
// Back-to-back slots (one ends exactly when the next starts) do not overlap.
// Call expireStaleReservations first so dead reservations are not counted.
const buildOverlapQuery = (equipmentObjectId, start, end) => ({
  equipment: equipmentObjectId,
  $or: [
    // Slot reservations. FULFILLED ones still occupy their slot.
    {
      status: { $in: ["ACTIVE", "FULFILLED"] },
      startTime: { $lt: end },
      endTime: { $gt: start }
    },
    // Old 30-minute holds (no startTime) that are still running
    {
      status: "ACTIVE",
      startTime: null,
      createdAt: { $lt: end },
      expiresAt: { $gt: start }
    }
  ]
});

// The ACTIVE reservation that applies to equipment RIGHT NOW:
// its slot has started and its claim deadline has not passed.
// A reservation for a future slot does not count yet.
const findStartedActiveReservation = (equipmentObjectId, now = new Date()) =>
  Reservation.findOne({
    equipment: equipmentObjectId,
    status: "ACTIVE",
    expiresAt: { $gt: now },
    $or: [{ startTime: null }, { startTime: { $lte: now } }]
  });

module.exports = {
  expireStaleReservations,
  buildOverlapQuery,
  findStartedActiveReservation,
  getBlockingReservation
};