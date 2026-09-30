const Reservation = require("../models/Reservation");
const Equipment = require("../models/Equipment");

// Create a reservation
const createReservation = async (req, res) => {
    try {
        const { equipmentId, startTime, endTime } = req.body;

        if (!equipmentId || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: "Equipment, start time and end time are required"
            });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        if (isNaN(start) || isNaN(end)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date or time"
            });
        }

        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: "End time must be after start time"
            });
        }

        // Find equipment
        const equipment = await Equipment.findById(equipmentId);

        if (!equipment) {
            return res.status(404).json({
                success: false,
                message: "Equipment not found"
            });
        }

        // Check equipment status
        if (
            equipment.status === "DAMAGED" ||
            equipment.status === "MAINTENANCE" ||
            equipment.status === "LOST" ||
            equipment.status === "RETIRED"
        ) {
            return res.status(400).json({
                success: false,
                message: "Equipment is currently unavailable"
            });
        }

        // Check overlapping reservations
        const overlappingReservation = await Reservation.findOne({
            equipment: equipmentId,
            status: {
                $in: ["RESERVED", "VERIFIED", "ISSUED"]
            },
            startTime: { $lt: end },
            endTime: { $gt: start }
        });

        if (overlappingReservation) {
            return res.status(400).json({
                success: false,
                message: "Equipment is already reserved for this time"
            });
        }

        // Create reservation
        const reservation = await Reservation.create({
            student: req.user._id,
            equipment: equipmentId,
            startTime: start,
            endTime: end,
            status: "RESERVED"
        });

        res.status(201).json({
            success: true,
            message: "Equipment reserved successfully",
            reservation
        });

    } catch (error) {
        console.error("CREATE RESERVATION ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get all reservations
const getReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find()
            .populate("student", "name email srn")
            .populate("equipment", "equipmentId name category");

        res.status(200).json({
            success: true,
            reservations
        });

    } catch (error) {
        console.error("GET RESERVATIONS ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// Get logged-in student's reservations
const getMyReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find({
            student: req.user._id
        })
            .populate("equipment", "equipmentId name category")
            .sort({ startTime: 1 });

        res.status(200).json({
            success: true,
            reservations
        });

    } catch (error) {
        console.error("GET MY RESERVATIONS ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


module.exports = {
    createReservation,
    getReservations,
    getMyReservations
};