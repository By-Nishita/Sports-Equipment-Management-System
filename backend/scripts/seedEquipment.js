require("dotenv").config();

const mongoose = require("mongoose");
const EquipmentType = require("../models/EquipmentType");
const EquipmentUnit = require("../models/EquipmentUnit");

// Sample data for a DEVELOPMENT database. Safe to run again: a type or unit that already
// exists is left alone. Each type gets UNITS_PER_TYPE units, e.g. SEMS-001-01, SEMS-001-02.
const UNITS_PER_TYPE = 2;

const equipmentList = [
    ["Discuss 1 KG", "Athletics"],
    ["Discuss 1.5 KG", "Athletics"],
    ["Athletics Batton", "Athletics"],
    ["Basketball (7 No.)", "Basketball"],
    ["Basketball (6 No.)", "Basketball"],
    ["Basketball Net", "Basketball"],
    ["Badminton Shuttle (Plastic)", "Badminton"],
    ["Badminton Shuttle (Feather)", "Badminton"],
    ["Badminton Racket", "Badminton"],
    ["Badminton Net", "Badminton"],
    ["Cricket Bat (Leather Ball)", "Cricket"],
    ["Cricket Bat (Tennis Ball)", "Cricket"],
    ["Cricket Ball (Leather)", "Cricket"],
    ["Cricket Ball (Tennis)", "Cricket"],
    ["Cricket Batting Pads", "Cricket"],
    ["Cricket Batting Gloves", "Cricket"],
    ["Cricket Thigh Pad", "Cricket"],
    ["Cricket Elbow Guard", "Cricket"],
    ["Cricket WK Gloves", "Cricket"],
    ["Cricket WK Pads", "Cricket"],
    ["Cricket Stumps (Wooden)", "Cricket"],
    ["Cricket Helmet", "Cricket"],
    ["Cricket Practice Net", "Cricket"],
    ["Cricket Matting (Full)", "Cricket"],
    ["Chess Board / Mat", "Chess"],
    ["Chess Clock", "Chess"],
    ["Carrom Board", "Carrom"],
    ["Carrom Men", "Carrom"],
    ["Carrom Striker", "Carrom"],
    ["Carrom Powder", "Carrom"],
    ["Football", "Football"],
    ["Handball", "Handball"],
    ["Handball Net", "Handball"],
    ["T T Bat", "Table Tennis"],
    ["T. T. Ball", "Table Tennis"],
    ["T. T. Net", "Table Tennis"],
    ["T T Post", "Table Tennis"],
    ["Volleyball (Leather Pasted)", "Volleyball"],
    ["Volleyball Net", "Volleyball"],
    ["Volleyball Antenna", "Volleyball"],
    ["Throwball", "Throwball"],
    ["Measuring Tape (30 M & 50 M)", "Athletics"],
    ["Air Pump", "General Sports"],
    ["Skippping Rope", "Fitness & Yoga"],
    ['Cones (Practice) 12"', "Athletics"],
    ["Shot Put (8 lbs)", "Athletics"],
    ["Shot Put (16 lbs)", "Athletics"],
    ["Net wire", "General Sports"],
    ["Kho Kho Pole", "Kho Kho"],
    ["T. T. Table", "Table Tennis"],
    ["Volleyball Post", "Volleyball"],
    ["Carrom Stand", "Carrom"],
    ["Rope (Tug of War)", "Athletics"],
    ["Whistle", "General Sports"],
    ["Javeline (600)", "Athletics"],
    ['Cones (Practice) 6"', "Athletics"],
    ['Cones (Practice) 9"', "Athletics"],
    ["Yoga Mat", "Fitness & Yoga"],
    ["Cricket Kit Bag", "Cricket"],
    ["Cricket Stumps (Plastic)", "Cricket"],
    ["Cricket (Bat Gripper)", "Cricket"],
    ["Cricket Bat Grip", "Cricket"],
    ["Football Corner Flag", "Football"],
    ["T T Post with Net", "Table Tennis"],
    ["Stop Watch", "Athletics"],
    ["Air Walker", "Fitness & Yoga"],
    ["Chest Press", "Fitness & Yoga"],
    ["Cross Trainer", "Fitness & Yoga"],
    ["Trunk Twister", "Fitness & Yoga"],
    ["Shoulder Press", "Fitness & Yoga"],
    ["Double Rower", "Fitness & Yoga"]
];

async function seedEquipment() {
    const stats = { types: 0, units: 0, skipped: 0 };
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log("Connected to MongoDB.");

        for (let i = 0; i < equipmentList.length; i++) {
            const [name, category] = equipmentList[i];
            const qrIdentifier = EquipmentType.qrFromName(name);

            let type = await EquipmentType.findOne({ qrIdentifier });
            if (type) stats.skipped++;
            else {
                type = await EquipmentType.create({ name, category, qrIdentifier });
                stats.types++;
            }

            for (let n = 1; n <= UNITS_PER_TYPE; n++) {
                const unitCode = `SEMS-${String(i + 1).padStart(3, "0")}-${String(n).padStart(2, "0")}`;
                const r = await EquipmentUnit.updateOne(
                    { unitCode },
                    { $setOnInsert: { unitCode, type: type._id, status: "AVAILABLE", condition: "GOOD" } },
                    { upsert: true }
                );
                if (r.upsertedCount) stats.units++;
            }
        }

        console.log("\n--- Seeding Summary ---");
        console.log("Equipment types in list:", equipmentList.length);
        console.log("New types:", stats.types, "| already existed:", stats.skipped);
        console.log("New units:", stats.units);
    } catch (error) {
        console.error("Equipment seeding failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedEquipment();
