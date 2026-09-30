const Equipment = require("../models/Equipment");
const UsageSession = require("../models/UsageSession");

const DEFAULT_ISSUE_HOURS = 2;

const issueEquipment = async (req, res) => {
  try {
    const { equipmentId } = req.body;

    if (!equipmentId) {
      return res.status(400).json({ success: false, message: "equipmentId is required" });
    }

    const equipment = await Equipment.findOneAndUpdate(
      { equipmentId, status: "AVAILABLE" },
      { status: "IN_USE" },
      { new: true }
    );

    if (!equipment) {
      const existing = await Equipment.findOne({ equipmentId });
      if (!existing) {
        return res.status(404).json({ success: false, message: "Equipment not found" });
      }
      return res.status(400).json({
        success: false,
        message: `Equipment is not available (current status: ${existing.status})`
      });
    }

    const dueAt = new Date(Date.now() + DEFAULT_ISSUE_HOURS * 60 * 60 * 1000);

    try {
      const session = await UsageSession.create({
        equipment: equipment._id,
        user: req.user._id, // protect middleware ne req.user set kiya hai
        dueAt
      });

      await session.populate("equipment", "equipmentId name category");

      return res.status(201).json({
        success: true,
        message: "Equipment issued successfully",
        session
      });
    } catch (err) {
      await Equipment.updateOne({ _id: equipment._id }, { status: "AVAILABLE" });
      throw err;
    }
  } catch (error) {
    console.error("ISSUE ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const VALID_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "DAMAGED"];

const returnEquipment = async (req, res) => {
  try {
    const { equipmentId, condition } = req.body;

    if (!equipmentId || !condition) {
      return res.status(400).json({ success: false, message: "equipmentId and condition are required" });
    }
    if (!VALID_CONDITIONS.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: `condition must be one of: ${VALID_CONDITIONS.join(", ")}`
      });
    }

    const equipment = await Equipment.findOne({ equipmentId });
    if (!equipment) {
      return res.status(404).json({ success: false, message: "Equipment not found" });
    }

    const session = await UsageSession.findOne({ equipment: equipment._id, status: "ACTIVE" });
    if (!session) {
      return res.status(400).json({ success: false, message: "This equipment is not currently issued" });
    }

    // Sirf issue karne wala ya staff/admin return kar sakta hai
    const isOwner = session.user.toString() === req.user._id.toString();
    const isStaff = ["admin", "staff"].includes(req.user.role);
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: "You did not issue this equipment" });
    }

    const returnedAt = new Date();
    const durationMinutes = Math.round((returnedAt - session.issuedAt) / 60000);

    // status: "ACTIVE" wapas check, taaki double return na ho
    const updatedSession = await UsageSession.findOneAndUpdate(
      { _id: session._id, status: "ACTIVE" },
      { status: "RETURNED", returnedAt, durationMinutes, returnCondition: condition },
      { new: true }
    );
    if (!updatedSession) {
      return res.status(409).json({ success: false, message: "Already returned" });
    }

    equipment.condition = condition;
    equipment.status = condition === "DAMAGED" ? "DAMAGED" : "AVAILABLE";
    await equipment.save();

    res.json({
      success: true,
      message: condition === "DAMAGED"
        ? "Returned. Equipment marked as damaged and needs staff review"
        : "Equipment returned successfully",
      session: updatedSession,
      equipmentStatus: equipment.status
    });
  } catch (error) {
    console.error("RETURN ERROR:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { issueEquipment, returnEquipment };