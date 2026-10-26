const Equipment = require("../models/Equipment");
const UsageSession = require("../models/UsageSession");
const DamageReport = require("../models/DamageReport");
const Reservation = require("../models/Reservation");

const DAY_MS = 24 * 60 * 60 * 1000;

// Which timezone counts as "a day" for the usage chart.
// Without this, a server running in another timezone would cut the days at the wrong hour.
const TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
// Max minutes one session can add to the chart
const MAX_SESSION_MINUTES = 12 * 60;

// Equipment status in the database -> key name in our response
const STATUS_KEYS = {
  AVAILABLE: "available",
  IN_USE: "inUse",
  DAMAGED: "damaged",
  MAINTENANCE: "maintenance",
  LOST: "lost",
  RETIRED: "retired"
};

const CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "DAMAGED"];

// Turns a Date into a day string like "2026-10-12" (in TIMEZONE)
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" });

const round1 = (n) => Math.round(n * 10) / 10;

// Builds the 7-day usage chart data and compares it with the 7 days before.
// byDay looks like { "2026-10-12": 95, ... } where the number is minutes used on that day.
const buildUtilization = (byDay, now) => {
  const days = [];
  let thisWeekMinutes = 0;
  let lastWeekMinutes = 0;

  // i = how many days ago. 0..6 is this week (shown in the chart), 7..13 is last week.
  for (let i = 13; i >= 0; i--) {
    const date = dayFormatter.format(new Date(now.getTime() - i * DAY_MS));
    const minutes = byDay[date] || 0; // a day with no sessions has no row, so default to 0

    if (i <= 6) {
      thisWeekMinutes += minutes;
      days.push({
        date,
        // Day name (Mon, Tue...). Noon UTC is used so the date can never slip to another day.
        label: weekdayFormatter.format(new Date(`${date}T12:00:00Z`)),
        hours: round1(minutes / 60)
      });
    } else {
      lastWeekMinutes += minutes;
    }
  }

  return {
    days,
    totalHours: round1(thisWeekMinutes / 60),
    previousHours: round1(lastWeekMinutes / 60),
    // If last week had no usage, a percentage change is meaningless, so we send null
    changePercent:
      lastWeekMinutes > 0 ? round1(((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes) * 100) : null
  };
};

// GET /api/dashboard/stats
// Staff/admin only (the route applies authorize)
const getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    // 15 days back (not 14) so that day 13 ago is fully covered whatever the timezone
    const since = new Date(now.getTime() - 15 * DAY_MS);

    // All queries run at the same time instead of one after another, so the reply is faster
    const [
      byStatus,
      byCondition,
      valueRows,
      usageRows,
      recentSessions,
      overdueSessions,
      pendingReports,
      underReviewReports,
      activeReservations
    ] = await Promise.all([
      // Group equipment by status and count each group (the database does the counting)
      Equipment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      // Same idea, grouped by condition (Excellent, Good, ...) for Inventory health
      Equipment.aggregate([{ $group: { _id: "$condition", count: { $sum: 1 } } }]),
      // Inventory value = sum of prices. Lost and retired items are not worth counting.
      Equipment.aggregate([
        { $match: { status: { $nin: ["LOST", "RETIRED"] } } },
        { $group: { _id: null, value: { $sum: "$price" } } }
      ]),
      // Minutes used per day, from sessions that were returned in the last 15 days
      UsageSession.aggregate([
        { $match: { status: "RETURNED", returnedAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$returnedAt", timezone: TIMEZONE } },
            minutes: { $sum: { $min: ["$durationMinutes", MAX_SESSION_MINUTES] } }          }
        }
      ]),
      
      UsageSession.find({ status: { $in: ["ACTIVE", "RETURN_PENDING", "RETURNED"] } })
        .sort({ approvedAt: -1 })
        .limit(6)
        .populate("user", "name srn")
        .populate("type", "name category")
        .populate("unit", "unitCode")
        .lean(),

      // Overdue = still ACTIVE and the due time is already in the past
      UsageSession.countDocuments({ status: "ACTIVE", dueAt: { $lt: now } }),
      DamageReport.countDocuments({ status: "PENDING" }),
      DamageReport.countDocuments({ status: "UNDER_REVIEW" }),
      // A booking counts while it is ACTIVE and its claim deadline has not passed
      Reservation.countDocuments({ status: "ACTIVE", expiresAt: { $gt: now } })
    ]);

    // Start every counter at 0, so a status with no items still shows 0 (not missing)
    const equipment = {
      total: 0,
      available: 0,
      inUse: 0,
      damaged: 0,
      maintenance: 0,
      lost: 0,
      retired: 0
    };
    for (const row of byStatus) {
      equipment.total += row.count;
      const key = STATUS_KEYS[row._id];
      if (key) equipment[key] = row.count;
    }

    const conditions = {};
    for (const name of CONDITIONS) conditions[name] = 0;
    for (const row of byCondition) {
      if (row._id in conditions) conditions[row._id] = row.count;
    }

    // [{ _id: "2026-10-12", minutes: 95 }] -> { "2026-10-12": 95 }
    const byDay = {};
    for (const row of usageRows) byDay[row._id] = row.minutes;

    return res.json({
      success: true,
      stats: {
        equipment,
        sessions: { overdue: overdueSessions },
        damageReports: { pending: pendingReports, underReview: underReviewReports },
        reservations: { active: activeReservations },
        utilization: buildUtilization(byDay, now),
        inventory: {
          conditions,
          value: valueRows[0]?.value || 0
        },
        // lean() gives plain objects, which have no virtual isOverdue,
        // so we work out each session's state here ourselves
        recentSessions: recentSessions.map((s) => ({
                    _id: s._id,
          equipment: s.type ? { equipmentId: s.unit ? s.unit.unitCode : "-", name: s.type.name } : null,
          user: s.user ? { name: s.user.name, srn: s.user.srn } : null,
          issuedAt: s.approvedAt,
          returnedAt: s.returnedAt,
          durationMinutes: s.durationMinutes,
          state: s.status === "RETURNED" ? "RETURNED" : s.dueAt && s.dueAt < now ? "OVERDUE" : "ACTIVE"
        })),
        generatedAt: now
      }
    });
  } catch (error) {
    // The real error goes to the terminal only; the client gets a fixed message
    console.error("DASHBOARD STATS ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getDashboardStats };
