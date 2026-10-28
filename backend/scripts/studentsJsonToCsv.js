// ONE-TIME helper: turns your local backend/scripts/students.json into students.csv,
// the file the admin "Import students" page understands.
//
// Run from the backend folder:
//   node scripts/studentsJsonToCsv.js
// Then upload scripts/students.csv on the Students and staff page (Check file first).
// Both students.json and students.csv are in .gitignore: never commit them.
const fs = require('fs');
const path = require('path');

const input = path.join(__dirname, 'students.json');
const output = path.join(__dirname, 'students.csv');

if (!fs.existsSync(input)) {
  console.error('students.json not found in backend/scripts/');
  process.exit(1);
}

const students = JSON.parse(fs.readFileSync(input, 'utf-8'));
const columns = ['srn', 'name', 'email', 'department', 'program', 'division', 'year'];
const headers = ['SRN', 'Name', 'Email', 'Department', 'Program', 'Division', 'Year'];

// A cell with a comma, quote or new line must be wrapped in quotes
const cell = (value) => {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const lines = [headers.join(',')];
for (const s of students) lines.push(columns.map((c) => cell(s[c])).join(','));

fs.writeFileSync(output, lines.join('\n') + '\n', 'utf-8');
console.log(`Wrote ${students.length} students to ${output}`);
