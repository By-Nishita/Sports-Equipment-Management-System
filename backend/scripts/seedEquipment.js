require("dotenv").config();

const mongoose = require("mongoose");
const QRCode = require("qrcode");
const Equipment = require("../models/Equipment");

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
    let inserted = 0;
    let skipped = 0;

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB.");

        console.log(`Equipment entries in seed list: ${equipmentList.length}`);

        for (let i = 0; i < equipmentList.length; i++) {
            const [name, category] = equipmentList[i];

            const equipmentId = `SEMS-${String(i + 1).padStart(3, "0")}`;

            // Preserve any equipment record that already uses this ID.
            const existing = await Equipment.findOne({ equipmentId });

            if (existing) {
                console.log(`Skipped existing: ${equipmentId} - ${existing.name}`);
                skipped++;
                continue;
            }

            const qrData = JSON.stringify({
                equipmentId,
                name
            });

            const qrIdentifier = await QRCode.toDataURL(qrData);

            await Equipment.create({
                equipmentId,
                name,
                category,
                status: "AVAILABLE",
                condition: "GOOD",
                qrIdentifier
            });

            console.log(`Added: ${equipmentId} - ${name}`);
            inserted++;
        }

        console.log("\n--- Seeding Summary ---");
        console.log("Items in university list:", equipmentList.length);
        console.log("New items inserted:", inserted);
        console.log("Existing IDs skipped:", skipped);
        console.log(
            "Total equipment records in database:",
            await Equipment.countDocuments()
        );
    } catch (error) {
        console.error("Equipment seeding failed:", error.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
}

seedEquipment();