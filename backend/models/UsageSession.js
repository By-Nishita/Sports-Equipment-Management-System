const mongoose = require("mongoose");

const usageSessionSchema = new mongoose.Schema(
  {
    equipment: { type: mongoose.Schema.Types.ObjectId, ref: "Equipment", required: true },
    user:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    issuedAt:   { type: Date, default: Date.now },
    dueAt:      { type: Date, required: true },
    returnedAt: { type: Date, default: null },

    durationMinutes: { type: Number, default: null },
    returnCondition: { type: String, enum: ["EXCELLENT", "GOOD", "FAIR", "DAMAGED"] },

    status: { type: String, enum: ["ACTIVE", "RETURNED"], default: "ACTIVE" }
  },
  { timestamps: true, toJSON: { virtuals: true } }
);

usageSessionSchema.virtual("isOverdue").get(function () {
  return this.status === "ACTIVE" && this.dueAt < new Date();
});

usageSessionSchema.index(
  { equipment: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } }
);

module.exports = mongoose.model("UsageSession", usageSessionSchema);