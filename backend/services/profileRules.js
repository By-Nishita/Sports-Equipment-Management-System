// Pure rules for the profile page (no database), so they are easy to test.

// Phone: 10 to 15 digits, an optional leading +. Spaces and dashes are ignored.
// Returns the cleaned phone, "" (to clear it), or null when it is not a valid phone.
function cleanPhone(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text === "") return "";
  const compact = text.replace(/[\s-]/g, "");
  return /^\+?[0-9]{10,15}$/.test(compact) ? compact : null;
}

// Share of returned sessions that were not late, as a whole number. No returns yet => null.
function onTimePercent(returned, late) {
  if (!returned) return null;
  return Math.round(((returned - late) / returned) * 100);
}

// 135 minutes => 2.3 (one decimal)
function hoursFromMinutes(minutes) {
  return Math.round((minutes || 0) / 6) / 10;
}

module.exports = { cleanPhone, onTimePercent, hoursFromMinutes };
