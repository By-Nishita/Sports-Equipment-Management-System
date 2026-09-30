[1mdiff --git a/backend/controllers/equipmentController.js b/backend/controllers/equipmentController.js[m
[1mindex d9cfad0..5273710 100644[m
[1m--- a/backend/controllers/equipmentController.js[m
[1m+++ b/backend/controllers/equipmentController.js[m
[36m@@ -3,24 +3,37 @@[m [mconst QRCode = require("qrcode");[m
 [m
 const createEquipment = async (req, res) => {[m
     try {[m
[31m-        const { name, category, quantity, availableQuantity, condition } = req.body;[m
[31m-[m
[31m-        const equipment = new Equipment({[m
[32m+[m[32m        const {[m
[32m+[m[32m            equipmentId,[m
             name,[m
             category,[m
[31m-            quantity,[m
[31m-            availableQuantity,[m
[32m+[m[32m            brand,[m
[32m+[m[32m            purchaseDate,[m
[32m+[m[32m            price,[m
[32m+[m[32m            location,[m
[32m+[m[32m            status,[m
             condition[m
[31m-        });[m
[32m+[m[32m        } = req.body;[m
 [m
         const qrData = JSON.stringify({[m
[31m-            equipmentId: equipment._id,[m
[31m-            name: equipment.name[m
[32m+[m[32m            equipmentId,[m
[32m+[m[32m            name[m
         });[m
 [m
         const qrCode = await QRCode.toDataURL(qrData);[m
 [m
[31m-        equipment.qrCode = qrCode;[m
[32m+[m[32m        const equipment = new Equipment({[m
[32m+[m[32m            equipmentId,[m
[32m+[m[32m            name,[m
[32m+[m[32m            category,[m
[32m+[m[32m            brand,[m
[32m+[m[32m            purchaseDate,[m
[32m+[m[32m            price,[m
[32m+[m[32m            location,[m
[32m+[m[32m            status,[m
[32m+[m[32m            condition,[m
[32m+[m[32m            qrIdentifier: qrCode[m
[32m+[m[32m        });[m
 [m
         await equipment.save();[m
 [m
[36m@@ -29,6 +42,7 @@[m [mconst createEquipment = async (req, res) => {[m
             message: "Equipment created successfully",[m
             equipment[m
         });[m
[32m+[m
     } catch (error) {[m
         res.status(500).json({[m
             success: false,[m
[36m@@ -45,6 +59,7 @@[m [mconst getEquipment = async (req, res) => {[m
             success: true,[m
             equipment[m
         });[m
[32m+[m
     } catch (error) {[m
         res.status(500).json({[m
             success: false,[m
[36m@@ -56,4 +71,4 @@[m [mconst getEquipment = async (req, res) => {[m
 module.exports = {[m
     createEquipment,[m
     getEquipment[m
[31m-};[m
[32m+[m[32m};[m
\ No newline at end of file[m
[1mdiff --git a/backend/models/Equipment.js b/backend/models/Equipment.js[m
[1mindex d371250..42a6404 100644[m
[1m--- a/backend/models/Equipment.js[m
[1m+++ b/backend/models/Equipment.js[m
[36m@@ -2,6 +2,12 @@[m [mconst mongoose = require("mongoose");[m
 [m
 const equipmentSchema = new mongoose.Schema([m
     {[m
[32m+[m[32m        equipmentId: {[m
[32m+[m[32m            type: String,[m
[32m+[m[32m            required: true,[m
[32m+[m[32m            unique: true[m
[32m+[m[32m        },[m
[32m+[m
         name: {[m
             type: String,[m
             required: true,[m
[36m@@ -14,27 +20,50 @@[m [mconst equipmentSchema = new mongoose.Schema([m
             trim: true[m
         },[m
 [m
[31m-        quantity: {[m
[31m-            type: Number,[m
[31m-            required: true,[m
[31m-            min: 0[m
[32m+[m[32m        brand: {[m
[32m+[m[32m            type: String[m
         },[m
 [m
[31m-        availableQuantity: {[m
[31m-            type: Number,[m
[31m-            required: true,[m
[31m-            min: 0[m
[32m+[m[32m        purchaseDate: {[m
[32m+[m[32m            type: Date[m
[32m+[m[32m        },[m
[32m+[m
[32m+[m[32m        price: {[m
[32m+[m[32m            type: Number[m
[32m+[m[32m        },[m
[32m+[m
[32m+[m[32m        location: {[m
[32m+[m[32m            type: String[m
[32m+[m[32m        },[m
[32m+[m
[32m+[m[32m        status: {[m
[32m+[m[32m            type: String,[m
[32m+[m[32m            enum: [[m
[32m+[m[32m                "AVAILABLE",[m
[32m+[m[32m                "IN_USE",[m
[32m+[m[32m                "DAMAGED",[m
[32m+[m[32m                "MAINTENANCE",[m
[32m+[m[32m                "LOST",[m
[32m+[m[32m                "RETIRED"[m
[32m+[m[32m            ],[m
[32m+[m[32m            default: "AVAILABLE"[m
         },[m
 [m
         condition: {[m
             type: String,[m
[31m-            enum: ["Good", "Needs Repair", "Damaged"],[m
[31m-            default: "Good"[m
[32m+[m[32m            enum: [[m
[32m+[m[32m                "EXCELLENT",[m
[32m+[m[32m                "GOOD",[m
[32m+[m[32m                "FAIR",[m
[32m+[m[32m                "DAMAGED"[m
[32m+[m[32m            ],[m
[32m+[m[32m            default: "GOOD"[m
         },[m
[31m-        qrCode: {[m
[31m-    type: String,[m
[31m-    required: true[m
[31m-}[m
[32m+[m
[32m+[m[32m        qrIdentifier: {[m
[32m+[m[32m            type: String,[m
[32m+[m[32m            unique: true[m
[32m+[m[32m        }[m
     },[m
     {[m
         timestamps: true[m
