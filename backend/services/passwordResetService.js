const crypto = require('crypto');
const PasswordReset = require('../models/PasswordReset');

const TOKEN_MINUTES = 15;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Makes a new link token for a user. Returns the REAL token (to put in the email).
// Only its hash is saved, so even someone who reads the database cannot use the links.
async function createToken(userId) {
  await PasswordReset.deleteMany({ userId, usedAt: null }); // an older unused link stops working
  const token = crypto.randomBytes(32).toString('hex');      // 64 random hex characters
  await PasswordReset.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_MINUTES * 60 * 1000)
  });
  return token;
}

// Finds a token that exists, is not used, and is not expired. Does NOT use it up.
async function findValid(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  return PasswordReset.findOne({ tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } });
}

// Uses the token up. The filter says "only if still unused", so if two people click at the
// same moment only ONE of them gets a result back. That makes the link single-use.
async function markUsed(record) {
  return PasswordReset.findOneAndUpdate({ _id: record._id, usedAt: null }, { usedAt: new Date() }, { new: true });
}

module.exports = { TOKEN_MINUTES, createToken, findValid, markUsed };
