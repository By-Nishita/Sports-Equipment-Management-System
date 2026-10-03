const mongoose = require("mongoose");

const damageReportSchema = new mongoose.Schema(
  {
    equipment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      required: true
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Agar report return ke time bani hai to us session ka link
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UsageSession",
      default: null
    },

    // Report kahan se aayi: return ke time ya student ne form se bheji
    source: {
      type: String,
      enum: ["RETURN", "STUDENT_REPORT"],
      default: "STUDENT_REPORT"
    },

    type: {
      type: String,
      enum: ["DAMAGE", "LOSS"],
      default: "DAMAGE"
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    status: {
      type: String,
      enum: ["PENDING", "UNDER_REVIEW", "RESOLVED"],
      default: "PENDING"
    },

    // Staff ka final faisla (RESOLVED hone par bharega)
    resolution: {
      type: String,
      enum: ["REPAIRED", "RETIRED", "LOST"],
      default: null
    },

    staffNote: {
      type: String,
      trim: true,
      default: ""
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

damageReportSchema.index({ status: 1, createdAt: -1 });
damageReportSchema.index({ reportedBy: 1, createdAt: -1 });

module.exports = mongoose.model("DamageReport", damageReportSchema);