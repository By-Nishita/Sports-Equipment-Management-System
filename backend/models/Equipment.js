const mongoose = require("mongoose");

const equipmentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        category: {
            type: String,
            required: true,
            trim: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 0
        },

        availableQuantity: {
            type: Number,
            required: true,
            min: 0
        },

        condition: {
            type: String,
            enum: ["Good", "Needs Repair", "Damaged"],
            default: "Good"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Equipment", equipmentSchema);