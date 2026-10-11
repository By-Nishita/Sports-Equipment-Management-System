// backend/services/reservationRules.js
//
// Pure helper (no database): booking rules and slot validation.
// Kept free of Mongoose so it can be unit-tested without a database.
//
// Time handling: every time is an absolute instant (UTC) on the server.
// The client must send ISO-8601 strings WITH an offset or "Z",
// e.g. "2026-10-16T16:00:00+05:30". Strings without an offset are
// rejected because the server cannot know which time zone they mean.

const MIN_DURATION_MINUTES = 30;
const MAX_DURATION_MINUTES = 120;
const MAX_ADVANCE_DAYS = 7;
const GRACE_MINUTES = 15;
// A start time a few seconds in the past (slow form submit) is accepted.
const PAST_TOLERANCE_MS = 60 * 1000;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const parseInstant = (value) => {
  if (typeof value !== "string" || !ISO_WITH_OFFSET.test(value)) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

// Claim deadline: startTime + grace period.
const getClaimDeadline = (startTime) =>
  new Date(startTime.getTime() + GRACE_MINUTES * MINUTE);

// Returns { ok: true, startTime, endTime, expiresAt }
// or      { ok: false, message }
const validateSlot = (startRaw, endRaw, now = new Date()) => {
  if (startRaw === undefined || endRaw === undefined) {
    return { ok: false, message: "startTime and endTime are required" };
  }

  const startTime = parseInstant(startRaw);
  const endTime = parseInstant(endRaw);

  if (!startTime || !endTime) {
    return {
      ok: false,
      message:
        "startTime and endTime must be ISO-8601 date-times with a time zone, e.g. 2026-10-16T16:00:00+05:30"
    };
  }

  if (endTime <= startTime) {
    return { ok: false, message: "endTime must be after startTime" };
  }

  if (startTime.getTime() < now.getTime() - PAST_TOLERANCE_MS) {
    return { ok: false, message: "Reservation cannot start in the past" };
  }

  if (startTime.getTime() > now.getTime() + MAX_ADVANCE_DAYS * DAY) {
    return {
      ok: false,
      message: `Reservations can be made at most ${MAX_ADVANCE_DAYS} days in advance`
    };
  }

  const minutes = (endTime - startTime) / MINUTE;

  if (minutes < MIN_DURATION_MINUTES) {
    return {
      ok: false,
      message: `Reservation must be at least ${MIN_DURATION_MINUTES} minutes long`
    };
  }

  if (minutes > MAX_DURATION_MINUTES) {
    return {
      ok: false,
      message: `Reservation can be at most ${MAX_DURATION_MINUTES} minutes long`
    };
  }

  return {
    ok: true,
    startTime,
    endTime,
    expiresAt: getClaimDeadline(startTime)
  };
};

module.exports = {
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MAX_ADVANCE_DAYS,
  GRACE_MINUTES,
  PAST_TOLERANCE_MS,
  parseInstant,
  getClaimDeadline,
  validateSlot
};
