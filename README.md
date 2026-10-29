# Sports-Equipment-Management-System
A group project for managing sports equipment (MERN stack). Students scan an item's QR code,
staff approve the issue and confirm the return, and admins manage equipment and damage reports.

## Setup (first time)

You need Node.js 20 or newer and a MongoDB database (local, or a free Atlas cluster).

### 1. Backend
```bash
cd backend
npm install            # includes helmet and zod
cp .env.example .env      # then open .env and fill in MONGO_URI and JWT_SECRET
npm run dev               # http://localhost:8000
```

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env      # optional for now
npm run dev               # http://localhost:5173
```

### 3. First data (development database only)
Run these from the `backend` folder:
```bash
node scripts/seedAdmin.js        # creates the first admin account
node scripts/seedEquipment.js    # sample equipment types and units for testing
```
Students are added by the admin: **Students and staff** page, then **Import students (CSV)**.
Columns: SRN, Name, Email (required), Department, Program, Division, Year. Press **Check file**
first (it shows new, updated, invalid and duplicate rows and changes nothing), then **Import**.
New students set their own password with "Forgot password" (SRN or email).
To turn the old `students.json` into a CSV once: `node scripts/studentsJsonToCsv.js`.
Real student lists (`students.json`, CSV files) must never be committed: they are in `.gitignore`.

## Tests
```bash
cd backend
node --test tests/*.test.js
```

## Roles
- **student**: scan, request, return, report damage, history, profile
- **staff**: everything a student can, plus approve requests, confirm returns, overdue list, verify damage
- **admin**: everything staff can, plus equipment, settings, audit log, final damage decisions

## Git rules
- Never push to `main`. Work on `priya/<task>` or `nishita/<task>` branches and open a PR.
- The other person reviews every PR.
- Never commit `.env` or student data.
