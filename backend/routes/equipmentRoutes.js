const express = require("express");

const {
    createEquipment,
    getEquipment
} = require("../controllers/equipmentController");

const router = express.Router();

router.post("/", createEquipment);
router.get("/", getEquipment);

module.exports = router;