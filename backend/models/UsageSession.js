const mongoose = require("mongoose");

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "DAMAGED"];
const SESSION_STATUSES = ["ISSUE_PENDING", "ACTIVE", "RETURN_PENDING", "RETURNED", "REJECTED", "EXPIRED"];

// One row = one "student borrows one item" story, from request to return.
const usageSessionSchema = new mongoose.Schema(
  {
    type: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentType", required: true }, // e.g. Football
    unit: { type: mongoose.Schema.Types.ObjectId, ref: "EquipmentUnit", default: null },   // e.g. FB-007, empty until staff approves
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    status: { type: String, enum: SESSION_STATUSES, default: "ISSUE_PENDING" },

    // Issue side
    requestedAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date, default: null },   // student ticked "I received this and will return it"
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    conditionBefore: { type: String, enum: CONDITIONS },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectReason: { type: String, default: "" },

    // Return side
    returnRequestedAt: { type: Date, default: null },  // the late clock STOPS here
    conditionClaimed: { type: String, enum: CONDITIONS },   // what the student says
    conditionNote: { type: String, default: "" },
    returnConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    returnedAt: { type: Date, default: null },              // when staff confirmed
    conditionVerified: { type: String, enum: CONDITIONS },  // what staff sees
    durationMinutes: { type: Number, default: null },
    wasLate: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: 0 },
    mismatchFlagged: { type: Boolean, default: false }      // staff said "this is not the unit that was issued"
  },
  {
    timestamps: true,
    toJSON: { virtuals: true }
  }
);

usageSessionSchema.virtual("isOverdue").get(function () {
  return this.status === "ACTIVE" && this.dueAt && this.dueAt < new Date();
});

// One unit can have only ONE active session at a time (the database enforces it, even if code has a bug).
// (A unit waiting to be returned cannot be issued again, because staff can only approve units that are AVAILABLE.)
usageSessionSchema.index({ unit: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" } });
// A student cannot have two waiting requests for the same type (stops double-tap).
usageSessionSchema.index({ user: 1, type: 1 }, { unique: true, partialFilterExpression: { status: "ISSUE_PENDING" } });
// For lists and reports
usageSessionSchema.index({ user: 1, createdAt: -1 });
usageSessionSchema.index({ status: 1, dueAt: 1 });
usageSessionSchema.index({ type: 1, requestedAt: -1 });
usageSessionSchema.index({ unit: 1, requestedAt: -1 });

module.exports = mongoose.model("UsageSession", usageSessionSchema);
module.exports.CONDITIONS = CONDITIONS;
module.exports.SESSION_STATUSES = SESSION_STATUSES;