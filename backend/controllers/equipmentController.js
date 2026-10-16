const Equipment = require("../models/Equipment");
const Reservation = require("../models/Reservation");
const QRCode = require("qrcode");
const { expireStaleReservations } = require("../services/reservationService");

const createEquipment = async (req, res) => {
    try {
        const {
            equipmentId,
            name,
            category,
            brand,
            purchaseDate,
            price,
            location,
            status,
            condition
        } = req.body;

        const qrData = JSON.stringify({
            equipmentId,
            name
        });

        const qrCode = await QRCode.toDataURL(qrData);

        const equipment = new Equipment({
            equipmentId,
            name,
            category,
            brand,
            purchaseDate,
            price,
            location,
            status,
            condition,
            qrIdentifier: qrCode
        });

        await equipment.save();

        res.status(201).json({
            success: true,
            message: "Equipment created successfully",
            equipment
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const getEquipment = async (req, res) => {
    try {
        const now = new Date();

        // Mark unclaimed reservations as NO_SHOW / EXPIRED first
        await expireStaleReservations({}, now);

        const filter = {};
        if (req.query.category) filter.category = req.query.category;
        if (req.query.status) filter.status = req.query.status;
        const equipment = await Equipment.find(filter);

        // Add reservation information to each equipment
        const equipmentWithReservation = await Promise.all(
            equipment.map(async (item) => {

                // Nearest upcoming/current active reservation
                const reservation = await Reservation.findOne({
                    equipment: item._id,
                    status: "ACTIVE",
                    expiresAt: { $gt: now }
                }).sort({ startTime: 1, createdAt: 1 });

                const result = item.toObject();

                result.isReserved = !!reservation;
                result.reservedByMe = reservation
                    ? reservation.user.toString() === req.user._id.toString()
                    : false;

                // Slot reservations show the slot end; old holds show expiresAt
                result.reservedUntil = reservation
                    ? (reservation.endTime || reservation.expiresAt)
                    : null;

                result.reservationStartTime = reservation
                    ? reservation.startTime
                    : null;

                // Only staff/admin should know who reserved it
                if (
                    reservation &&
                    ["admin", "staff"].includes(req.user.role)
                ) {
                    await reservation.populate(
                        "user",
                        "name email"
                    );

                    result.reservedBy = reservation.user;
                }

                return result;
            })
        );

        res.status(200).json({
            success: true,
            equipment: equipmentWithReservation
        });

    } catch (error) {
        console.error("GET EQUIPMENT ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



const updateEquipment = async (req, res) => {
    try {
        const allowed = [
            "name", "category", "brand", "purchaseDate",
            "price", "location", "condition"
        ];
        const updates = {};

        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        const equipment = await Equipment.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!equipment) {
            return res.status(404).json({ success: false, message: "Equipment not found" });
        }

        res.json({ success: true, message: "Equipment updated", equipment });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deactivateEquipment = async (req, res) => {
    try {
        const equipment = await Equipment.findById(req.params.id);
        if (!equipment) {
            return res.status(404).json({ success: false, message: "Equipment not found" });
        }

        const activeSession = await require("../models/UsageSession").findOne({
            equipment: equipment._id,
            status: "ACTIVE"
        });

        if (activeSession) {
            return res.status(409).json({
                success: false,
                message: "Cannot deactivate equipment with an active session"
            });
        }

        const activeReservation = await Reservation.findOne({
            equipment: equipment._id,
            status: "ACTIVE",
            expiresAt: { $gt: new Date() }
        });

        if (activeReservation) {
            return res.status(409).json({
                success: false,
                message: "Cancel active reservations before deactivating equipment"
            });
        }

        equipment.status = "RETIRED";
        await equipment.save();

        res.json({ success: true, message: "Equipment deactivated", equipment });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { createEquipment, getEquipment, updateEquipment, deactivateEquipment };

const reactivateEquipment = async (req, res) => {
    try {
        const equipment = await Equipment.findById(req.params.id);

        if (!equipment) {
            return res.status(404).json({
                success: false,
                message: "Equipment not found"
            });
        }

        if (equipment.status !== "RETIRED") {
            return res.status(400).json({
                success: false,
                message: "Only retired equipment can be reactivated"
            });
        }

        if (equipment.condition === "DAMAGED") {
            return res.status(400).json({
                success: false,
                message: "Repair the equipment before reactivating it"
            });
        }

        const UsageSession = require("../models/UsageSession");

        const activeSession = await UsageSession.findOne({
            equipment: equipment._id,
            status: "ACTIVE"
        });

        if (activeSession) {
            return res.status(409).json({
                success: false,
                message: "Cannot reactivate equipment with an active session"
            });
        }

        equipment.status = "AVAILABLE";
        await equipment.save();

        return res.json({
            success: true,
            message: "Equipment reactivated successfully",
            equipment
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports.reactivateEquipment = reactivateEquipment;
