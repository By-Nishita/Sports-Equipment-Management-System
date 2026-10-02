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
      enum: ["ACTIVE", "FULFILLED", "CANCELLED", "EXPIRED"],
      default: "ACTIVE",
    },

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

// One active reservation per equipment
reservationSchema.index(
  { equipment: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "ACTIVE" },
  }
);

// Useful for finding a user's reservations
reservationSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model("Reservation", reservationSchema);