const UsageSession = require("../models/UsageSession");

const getActiveSessions = async (req,res) => {
    try{
        const sessions = await UsageSession.find({ status: "ACTIVE"})
        .populate("user", "name email srn")
        .populate("equipment", "equipmentId name category")
        .sort({ issuedAt: -1});

        res.json({success: true, sessions});
    } catch (error) {
        console.error("GET ACTIVE ERROR:", error);
        res.status(500).json({success: false, message: "Server error"});
    }
};

const getOverdueSessions = async (req, res) => {
  try {
    const sessions = await UsageSession.find({
      status: "ACTIVE",
      dueAt: { $lt: new Date() }
    })
      .populate("user", "name email srn")
      .populate("equipment", "equipmentId name category")
      .sort({ dueAt: 1 });

    res.json({ success: true, sessions });
  } catch (error) {
    console.error("GET OVERDUE ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getMySessions = async (req, res) => {
  try {
    const sessions = await UsageSession.find({ user: req.user._id })
      .populate("equipment", "equipmentId name category")
      .sort({ issuedAt: -1 });

    res.json({ success: true, sessions });
  } catch (error) {
    console.error("GET MY SESSIONS ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getActiveSessions, getOverdueSessions, getMySessions };