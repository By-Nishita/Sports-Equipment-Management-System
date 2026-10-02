const Equipment = require("../models/Equipment");
const Reservation = require("../models/Reservation");
const QRCode = require("qrcode");

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

        // Expire old reservations first
        await Reservation.updateMany(
            {
                status: "ACTIVE",
                expiresAt: { $lte: now }
            },
            {
                $set: {
                    status: "EXPIRED"
                }
            }
        );

        const equipment = await Equipment.find();

        // Add reservation information to each equipment
        const equipmentWithReservation = await Promise.all(
            equipment.map(async (item) => {

                const reservation = await Reservation.findOne({
                    equipment: item._id,
                    status: "ACTIVE",
                    expiresAt: { $gt: now }
                });

                const result = item.toObject();

                result.isReserved = !!reservation;
                result.reservedByMe = reservation
                    ? reservation.user.toString() === req.user._id.toString()
                    : false;

                result.reservedUntil = reservation
                    ? reservation.expiresAt
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


module.exports = {
    createEquipment,
    getEquipment
};