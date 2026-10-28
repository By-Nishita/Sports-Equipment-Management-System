const mongoose = require("mongoose");
const { z } = require("zod");
const User = require("../models/User");
const UsageSession = require("../models/UsageSession");
const auditService = require("./auditService");
const { HttpError } = require("../utils/http");

// What an admin may change on another person's account.
// Admin accounts themselves are never changed here.
const patchSchema = z
  .object({
    isActive: z.boolean({ message: "isActive must be true or false" }).optional(),
    role: z.enum(["student", "staff"], { message: "role must be student or staff" }).optional()
  })
  .strict()
  .refine((v) => v.isActive !== undefined || v.role !== undefined, { message: "Nothing to change" });

const PUBLIC_FIELDS = "name srn email role department division year isActive mustChangePassword";

async function updateUser(admin, id, body) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "Invalid id");
  const parsed = patchSchema.safeParse(body || {});
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
  const { isActive, role } = parsed.data;

  const target = await User.findById(id).select("role isActive");
  if (!target) throw new HttpError(404, "User not found");
  if (target.role === "admin") throw new HttpError(403, "Admin accounts cannot be changed here");

  const changes = {};
  if (role !== undefined && role !== target.role) changes.role = role;

  if (isActive !== undefined && isActive !== target.isActive) {
    if (isActive === false) {
      // Closing an account while they hold an item would leave the item with nobody
      const holding = await UsageSession.exists({ user: target._id, status: { $in: ["ACTIVE", "RETURN_PENDING"] } });
      if (holding) throw new HttpError(409, "This person still has an item that is not returned. Close the account after the return.");
      changes.isActive = false;
      changes.passwordChangedAt = new Date(); // every login of theirs stops working at once
    } else {
      changes.isActive = true;
    }
  }

  if (Object.keys(changes).length === 0) {
    return User.findById(id).select(PUBLIC_FIELDS);
  }

  // Only change an account that is still not an admin (one atomic step)
  const updated = await User.findOneAndUpdate({ _id: id, role: { $ne: "admin" } }, changes, { new: true }).select(PUBLIC_FIELDS);
  if (!updated) throw new HttpError(409, "The account changed while you were editing. Refresh and try again.");

  if (changes.isActive !== undefined) {
    await auditService.log({
      actor: admin._id, action: changes.isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      entityType: "User", entityId: updated._id, meta: { srn: updated.srn, email: updated.email }
    });
  }
  if (changes.role !== undefined) {
    await auditService.log({
      actor: admin._id, action: "USER_ROLE_CHANGED", entityType: "User", entityId: updated._id,
      meta: { srn: updated.srn, role: updated.role }
    });
  }
  return updated;
}

module.exports = { updateUser };
