
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/authRoutes");
const connectDB = require("./config/db");
const equipmentRoutes = require("./routes/equipmentRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const damageReportRoutes = require("./routes/damageReportRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const auditRoutes = require("./routes/auditRoutes");
const userRoutes = require("./routes/userRoutes");
const stockAuditRoutes = require("./routes/stockAuditRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const sanitizeBody = require("./middleware/sanitizeBody");
const { notFound, errorHandler } = require("./middleware/errorHandlers");

dotenv.config();

const app = express();

// ---- Security (Priya) ----
// Behind a host's proxy, req.ip is the visitor, not the proxy (the login rate limit needs this)
app.set("trust proxy", 1);
app.use(helmet());
// Only our own frontend may call the API from a browser. FRONTEND_URL can hold several
// addresses separated by commas.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" }));
app.use(sanitizeBody);

app.use("/api/equipment", equipmentRoutes);
app.use("/api/equipment", require("./routes/equipmentTypeUnitRoutes"));
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/damage-reports", damageReportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/users", userRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/stock-audits", stockAuditRoutes);

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

// ---- Must be last: unknown URLs and any unexpected error ----
app.use("/api", notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});