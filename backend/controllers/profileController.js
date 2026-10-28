const profileService = require("../services/profileService");
const { ok, handle } = require("../utils/http");

// GET /api/users/me/profile   (any logged-in user): details + stats
const getMine = handle(async (req, res) => {
  ok(res, await profileService.getProfile(req.user._id));
});

// PATCH /api/users/me   { phone }
const updateMine = handle(async (req, res) => {
  const user = await profileService.updatePhone(req.user, (req.body || {}).phone);
  ok(res, user, "Profile updated");
});

// POST /api/users/me/photo   (multipart field "photo")
const uploadMyPhoto = handle(async (req, res) => {
  const user = await profileService.setPhoto(req.user, req.file && req.file.buffer);
  ok(res, user, "Photo updated");
});

module.exports = { getMine, updateMine, uploadMyPhoto };
