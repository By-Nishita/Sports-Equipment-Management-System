const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const authRoutes = require('./routes/authRoutes');
const connectDB = require("./config/db");
const equipmentRoutes = require("./routes/equipmentRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const damageReportRoutes = require("./routes/damageReportRoutes");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/equipment", equipmentRoutes);
app.use('/api/auth', authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/damage-reports", damageReportRoutes);

connectDB();

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





