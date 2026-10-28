// Pure rules for the student CSV import (no database): read the header, check each row,
// find duplicates inside the file, and split the good rows into "new" and "update".
const { z } = require("zod");
const { parseCsv } = require("./csvParser");

const MAX_ROWS = 5000;
const REQUIRED = ["srn", "name", "email"];
const OPTIONAL = ["department", "program", "division", "year"];

// Header names people really type -> our field names
const ALIASES = {
  srn: "srn",
  name: "name",
  fullname: "name",
  studentname: "name",
  email: "email",
  emailid: "email",
  emailaddress: "email",
  department: "department",
  dept: "department",
  program: "program",
  programme: "program",
  division: "division",
  div: "division",
  year: "year"
};
const normalizeHeader = (h) => String(h || "").toLowerCase().replace(/[^a-z]/g, "");

const text = (label, min, max) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} is too long`);

// undefined becomes "" so a missing cell gives the same message as an empty one
const rowSchema = z.object({
  srn: text("SRN", 1, 20).regex(/^[A-Za-z0-9]{4,20}$/, "SRN must be 4 to 20 letters or digits"),
  name: text("Name", 2, 100),
  email: text("Email", 1, 120).email("Email is not valid"),
  department: text("Department", 0, 120),
  program: text("Program", 0, 120),
  division: text("Division", 0, 40),
  year: text("Year", 0, 40)
});

// Reads the whole CSV text. Never throws for bad content; returns:
//   { fileError }                                  when the file cannot be used at all
//   { rows, invalid, duplicates, totalRows }       otherwise
//   rows: valid, de-duplicated candidates [{ line, srn, name, email, department, ... }]
//   invalid: [{ line, srn, errors: [text] }]
//   duplicates: [{ line, srn, reason }]
function analyzeCsv(csvText) {
  let table;
  try {
    table = parseCsv(csvText);
  } catch (err) {
    return { fileError: err.message };
  }
  if (table.length === 0) return { fileError: "The file is empty" };

  const header = table[0].map((h) => ALIASES[normalizeHeader(h)] || null);
  const missing = REQUIRED.filter((f) => !header.includes(f));
  if (missing.length) {
    return { fileError: `Missing column: ${missing.map((m) => m.toUpperCase()).join(", ")}. The first row must be the column names.` };
  }

  const dataRows = table.slice(1);
  if (dataRows.length === 0) return { fileError: "The file has a header but no students" };
  if (dataRows.length > MAX_ROWS) return { fileError: `The file has more than ${MAX_ROWS} rows. Split it into smaller files.` };

  const rows = [];
  const invalid = [];
  const duplicates = [];
  const seenSrn = new Map(); // srn -> line
  const seenEmail = new Map();

  dataRows.forEach((cells, index) => {
    const line = index + 2; // line 1 is the header
    const raw = {};
    [...REQUIRED, ...OPTIONAL].forEach((f) => (raw[f] = ""));
    header.forEach((field, col) => {
      if (field && cells[col] !== undefined) raw[field] = String(cells[col]).trim();
    });

    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      invalid.push({ line, srn: raw.srn, errors: [...new Set(parsed.error.issues.map((i) => i.message))] });
      return;
    }
    const row = { ...parsed.data, srn: parsed.data.srn.toUpperCase(), email: parsed.data.email.toLowerCase() };

    if (seenSrn.has(row.srn)) {
      duplicates.push({ line, srn: row.srn, reason: `Same SRN as line ${seenSrn.get(row.srn)}` });
      return;
    }
    if (seenEmail.has(row.email)) {
      duplicates.push({ line, srn: row.srn, reason: `Same email as line ${seenEmail.get(row.email)}` });
      return;
    }
    seenSrn.set(row.srn, line);
    seenEmail.set(row.email, line);
    rows.push({ line, ...row });
  });

  return { rows, invalid, duplicates, totalRows: dataRows.length };
}

// Compare the good rows with the accounts that already exist.
//   existing: [{ srn, email, role }]  (accounts whose srn or email appears in the file)
// Returns { toCreate, toUpdate, invalid }
function splitByExisting(rows, existing) {
  const bySrn = new Map(existing.filter((u) => u.srn).map((u) => [String(u.srn).toUpperCase(), u]));
  const byEmail = new Map(existing.filter((u) => u.email).map((u) => [String(u.email).toLowerCase(), u]));

  const toCreate = [];
  const toUpdate = [];
  const invalid = [];

  for (const row of rows) {
    const same = bySrn.get(row.srn);
    const emailOwner = byEmail.get(row.email);

    if (same && same.role !== "student") {
      invalid.push({ line: row.line, srn: row.srn, errors: ["This SRN belongs to a staff or admin account"] });
    } else if (emailOwner && String(emailOwner.srn || "").toUpperCase() !== row.srn) {
      invalid.push({ line: row.line, srn: row.srn, errors: ["This email is already used by another account"] });
    } else if (same) {
      toUpdate.push(row);
    } else {
      toCreate.push(row);
    }
  }
  return { toCreate, toUpdate, invalid };
}

// The fields saved on the user (empty optional cells are left alone, never erased)
function detailsOf(row) {
  const details = { name: row.name, email: row.email };
  for (const f of OPTIONAL) if (row[f]) details[f] = row[f];
  return details;
}

module.exports = { MAX_ROWS, analyzeCsv, splitByExisting, detailsOf };
