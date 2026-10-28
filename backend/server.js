const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const authRoutes = require('./routes/authRoutes');
const connectDB = require("./config/db");
const equipmentRoutes = require("./routes/equipmentRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const damageReportRoutes = require("./routes/damageReportRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const auditRoutes = require("./routes/auditRoutes");
const userRoutes = require("./routes/userRoutes");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/equipment", equipmentRoutes);
app.use("/api/equipment", require("./routes/equipmentRoutes.n2-temp"));
app.use('/api/auth', authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/damage-reports", damageReportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/users", userRoutes);

connectDB();
// Every minute: waiting issue requests older than the approval timeout become EXPIRED.
setInterval(() => {
    require("./services/sessionService")
        .expireStaleRequests()
        .catch((err) => console.error("Expire requests failed:", err.message));
}, 60 * 1000);

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Sports Equipment Management System Backend is running"
    });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});





