const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    equipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      // NO_SHOW: slot start + 15 min passed and nobody claimed it (N1)
      // EXPIRED: used by the old 30-minute holds (no startTime)
      enum: ["ACTIVE", "FULFILLED", "CANCELLED", "EXPIRED", "NO_SHOW"],
      default: "ACTIVE",
    },

    // The booked slot. Optional in the schema ONLY so that old reservations
    // (created before slots existed) stay valid. The controller always
    // requires both for new reservations.
    startTime: {
      type: Date,
      default: null,
    },

    endTime: {
      type: Date,
      default: null,
    },

    // Claim deadline. Slot reservations: startTime + 15 minutes.
    // Old holds: creation time + 30 minutes.
    expiresAt: {
      type: Date,
      required: true,
    },

    fulfilledAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UsageSession",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// The old unique index "one ACTIVE reservation per equipment" was removed:
// the same equipment can now have several reservations for different slots.
// Overlap is checked in reservationService / reservationController instead.
//
// NOTE: removing it here does NOT drop it from an existing database.
// See backend/scripts/dropOldReservationIndex.js
reservationSchema.pre("validate", function (next) {
  if (this.startTime || this.endTime) {
    if (!this.startTime || !this.endTime) {
      return next(new Error("startTime and endTime must be set together"));
    }

    if (this.endTime <= this.startTime) {
      return next(new Error("endTime must be after startTime"));
    }
  }

  next();
});

// Overlap and lazy-expiry lookups per equipment
reservationSchema.index({ equipment: 1, status: 1, startTime: 1, endTime: 1 });

// Useful for finding a user's reservations
reservationSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("Reservation", reservationSchema);