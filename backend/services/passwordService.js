// Password rules live here, in one place, so login, change-password and
// (later) reset-password all use exactly the same rules.

const MIN_LENGTH = 8;

// Pure function: no database, easy to test.
// Returns a message string if the password is NOT acceptable, or null if it is fine.
function checkNewPassword(newPassword, user) {
  if (typeof newPassword !== 'string' || newPassword.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  const pw = newPassword.toLowerCase();
  const email = (user.email || '').toLowerCase();
  const emailName = email.split('@')[0];
  const srn = (user.srn || '').toLowerCase();

  if (srn && pw === srn) return 'Password cannot be your SRN';
  if (email && (pw === email || pw === emailName)) return 'Password cannot be your email';
  return null;
}

module.exports = { MIN_LENGTH, checkNewPassword };
