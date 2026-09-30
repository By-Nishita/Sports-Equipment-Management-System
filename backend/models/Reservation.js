const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        equipment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Equipment",
            required: true
        },

        startTime: {
            type: Date,
            required: true
        },

        endTime: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: [
                "RESERVED",
                "VERIFIED",
                "ISSUED",
                "CANCELLED"
            ],
            default: "RESERVED"
        },

        verifiedAt: {
            type: Date
        },

        cancelledAt: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Reservation", reservationSchema);