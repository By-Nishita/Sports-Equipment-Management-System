const mongoose = require("mongoose");

const REPORT_STATUSES = ["PENDING", "UNDER_REVIEW", "RESOLVED"];
const RESOLUTIONS = ["REPAIRED", "RETIRED", "LOST"];

// One row = one problem with ONE physical unit (for example FB-007).
const damageReportSchema = new mongoose.Schema(
  {
    // The exact physical unit
    unit: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentUnit", required: true },

    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Set when the report was created by a damaged return
    session: { type: mongoose.Schema.Types.ObjectId, ref: "UsageSession", default: null },

    // RETURN = staff saw it at the counter, STUDENT_REPORT = a student sent the form
    source: { type: String, enum: ["RETURN", "STUDENT_REPORT"], default: "STUDENT_REPORT" },

    type: { type: String, enum: ["DAMAGE", "LOSS"], default: "DAMAGE" },

    description: { type: String, required: true, trim: true },

    status: { type: String, enum: REPORT_STATUSES, default: "PENDING" },

    // Staff member who checked the item (PENDING -> UNDER_REVIEW, or at the counter on a return)
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },

    // Admin's final decision (only when RESOLVED)
    resolution: { type: String, enum: [...RESOLUTIONS, null], default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },

    staffNote: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

damageReportSchema.index({ status: 1, createdAt: -1 });
damageReportSchema.index({ reportedBy: 1, createdAt: -1 });
damageReportSchema.index({ unit: 1, status: 1 });

module.exports = mongoose.model("DamageReport", damageReportSchema);
module.exports.REPORT_STATUSES = REPORT_STATUSES;
module.exports.RESOLUTIONS = RESOLUTIONS;
