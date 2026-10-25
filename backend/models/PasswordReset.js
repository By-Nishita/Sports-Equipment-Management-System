const mongoose = require('mongoose');

// One row = one "set/reset password" link that was emailed.
// We never store the real token, only its SHA-256 hash (like a password).
const passwordResetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null }
});

// TTL index: MongoDB itself deletes the row soon after expiresAt. No cleanup code needed.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetSchema.index({ userId: 1 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);