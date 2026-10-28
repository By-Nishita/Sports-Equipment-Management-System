// A small CSV reader (RFC 4180): quotes, "" inside quotes, commas and new lines inside quotes,
// Windows or Unix line ends, and a leading BOM (Excel adds one). No package needed.
// parseCsv(text) returns an array of rows; each row is an array of strings.

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  // Excel in some regions saves with semicolons
  return semicolons > commas ? ";" : ",";
}

function parseCsv(input) {
  const text = String(input || "").replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let sawAny = false; // something (even an empty quoted value) was read on this line

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    // a line with only empty cells (or a blank line) is skipped
    if (sawAny && row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
    sawAny = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      sawAny = true;
    } else if (ch === delimiter) {
      sawAny = true;
      endField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      sawAny = true;
      field += ch;
    }
  }
  if (inQuotes) throw new Error("The file has a quote that is never closed");
  if (sawAny || field !== "" || row.length) endRow();
  return rows;
}

module.exports = { parseCsv };
