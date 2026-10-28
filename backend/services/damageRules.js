// Pure rules for damage reports (no database), so they are easy to test.

const RESOLUTIONS = ["REPAIRED", "RETIRED", "LOST"];

// A unit in these states is physically with a student. Its status belongs to the issue/return flow.
const WITH_STUDENT = ["IN_USE", "RETURN_PENDING"];
const OPEN_REPORT_STATUSES = ["PENDING", "UNDER_REVIEW"];

// What the admin's decision does to the unit.
function unitStatusForResolution(resolution) {
  return { REPAIRED: "AVAILABLE", RETIRED: "RETIRED", LOST: "LOST" }[resolution] || null;
}

// What a new report does to a unit that is on the shelf.
function unitStatusForNewReport(type) {
  return type === "LOSS" ? "LOST" : "DAMAGED";
}

// Unit statuses that BLOCK a resolution (used as $nin in the database filter).
// Nothing may change a unit that is with a student. A RETIRED unit cannot be "repaired" back.
function unitStatusesBlocking(resolution) {
  return resolution === "REPAIRED" ? [...WITH_STUDENT, "RETIRED"] : [...WITH_STUDENT];
}

module.exports = {
  RESOLUTIONS,
  WITH_STUDENT,
  OPEN_REPORT_STATUSES,
  unitStatusForResolution,
  unitStatusForNewReport,
  unitStatusesBlocking
};
