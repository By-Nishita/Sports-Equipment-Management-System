const mongoose = require("mongoose");

const usageSessionSchema = new mongoose.Schema(
  {
    equipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      required: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    issuedAt: {
      type: Date,
      default: Date.now
    },

    dueAt: {
      type: Date,
      required: true
    },

    returnedAt: {
      type: Date,
      default: null
    },

    durationMinutes: {
      type: Number,
      default: null
    },

    returnCondition: {
      type: String,
      enum: ["EXCELLENT", "GOOD", "FAIR", "DAMAGED"]
    },

    status: {
      type: String,
      enum: ["ACTIVE", "RETURNED"],
      default: "ACTIVE"
    },

    // Reservation used to issue this equipment
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
      default: null
    },

    // How the equipment was issued
    issuedVia: {
      type: String,
      enum: ["RESERVATION", "DIRECT"],
      default: "DIRECT"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }
  }
);

usageSessionSchema.virtual("isOverdue").get(function () {
  return this.status === "ACTIVE" && this.dueAt < new Date();
});

usageSessionSchema.index(
  { equipment: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "ACTIVE" }
  }
);

module.exports = mongoose.model("UsageSession", usageSessionSchema);