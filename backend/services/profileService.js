const mongoose = require("mongoose");
const User = require("../models/User");
const UsageSession = require("../models/UsageSession");
const auditService = require("./auditService");
const photoService = require("./photoService");
const rules = require("./profileRules");
const { HttpError } = require("../utils/http");

// Fields the profile page shows. The password hash is never included.
const PROFILE_FIELDS = "name email srn role department program division year phone photoUrl";

// One pass over the student's sessions gives all four numbers.
async function statsFor(userId) {
  const [row] = await UsageSession.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(userId)) } },
    {
      $group: {
        _id: null,
        returned: { $sum: { $cond: [{ $eq: ["$status", "RETURNED"] }, 1, 0] } },
        late: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "RETURNED"] }, { $eq: ["$wasLate", true] }] }, 1, 0] } },
        minutes: { $sum: { $cond: [{ $eq: ["$status", "RETURNED"] }, { $ifNull: ["$durationMinutes", 0] }, 0] } },
        holding: { $sum: { $cond: [{ $in: ["$status", ["ACTIVE", "RETURN_PENDING"]] }, 1, 0] } }
      }
    }
  ]);
  const r = row || { returned: 0, late: 0, minutes: 0, holding: 0 };
  return {
    totalSessions: r.returned,
    totalHours: rules.hoursFromMinutes(r.minutes),
    onTimePercent: rules.onTimePercent(r.returned, r.late),
    itemsHeldNow: r.holding
  };
}

async function getProfile(userId) {
  const user = await User.findById(userId).select(PROFILE_FIELDS);
  if (!user) throw new HttpError(404, "User not found");
  return { user, stats: await statsFor(userId) };
}

// The student may change only the phone number here (name, SRN, email come from college records).
async function updatePhone(user, phone) {
  const cleaned = rules.cleanPhone(phone);
  if (cleaned === null) throw new HttpError(400, "Enter a phone number with 10 to 15 digits");

  const updated = await User.findByIdAndUpdate(user._id, { phone: cleaned }, { new: true }).select(PROFILE_FIELDS);
  await auditService.log({ actor: user._id, action: "PROFILE_UPDATED", entityType: "User", entityId: user._id, meta: { field: "phone" } });
  return updated;
}

async function setPhoto(user, buffer) {
  if (!buffer) throw new HttpError(400, 'Upload a single JPG, PNG or WebP file in the "photo" field');
  const { photoUrl } = await photoService.uploadProfilePhoto(buffer, user._id);

  const updated = await User.findByIdAndUpdate(user._id, { photoUrl }, { new: true }).select(PROFILE_FIELDS);
  await auditService.log({ actor: user._id, action: "PROFILE_UPDATED", entityType: "User", entityId: user._id, meta: { field: "photo" } });
  return updated;
}

module.exports = { getProfile, updatePhone, setPhoto };
