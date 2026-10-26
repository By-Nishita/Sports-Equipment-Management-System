// Pure rules (no database), so they are easy to test.

const MINUTE = 60 * 1000;

// Late is measured to the moment the STUDENT asked to return, not when staff confirmed.
// Staff being slow must never make a student late.
function computeLate(dueAt, returnRequestedAt, graceMinutes) {
  const lateBy = Math.floor((returnRequestedAt.getTime() - dueAt.getTime()) / MINUTE); // minutes past due time
  const wasLate = lateBy > graceMinutes;
  return { wasLate, lateMinutes: wasLate ? lateBy : 0 };
}

// How long the student actually kept the item (stops at the return request).
function computeDuration(approvedAt, returnRequestedAt) {
  return Math.max(0, Math.round((returnRequestedAt.getTime() - approvedAt.getTime()) / MINUTE));
}

// Due time = approval time + hours. The per-type value wins, then the global setting.
function computeDueAt(approvedAt, typeHours, settingsHours) {
  const hours = Number(typeHours) > 0 ? Number(typeHours) : Number(settingsHours) || 2;
  return new Date(approvedAt.getTime() + hours * 60 * MINUTE);
}

// A waiting request older than this is dead.
function requestCutoff(now, timeoutMinutes) {
  return new Date(now.getTime() - timeoutMinutes * MINUTE);
}

module.exports = { computeLate, computeDuration, computeDueAt, requestCutoff };