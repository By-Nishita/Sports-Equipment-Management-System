const Equipment = require("../models/Equipment");
const QRCode = require("qrcode");

const createEquipment = async (req, res) => {
    try {
        const { name, category, quantity, availableQuantity, condition } = req.body;

        const equipment = new Equipment({
            name,
            category,
            quantity,
            availableQuantity,
            condition
        });

        const qrData = JSON.stringify({
            equipmentId: equipment._id,
            name: equipment.name
        });

        const qrCode = await QRCode.toDataURL(qrData);

        equipment.qrCode = qrCode;

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
        const equipment = await Equipment.find();

        res.status(200).json({
            success: true,
            equipment
        });
    } catch (error) {
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
