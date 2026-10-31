# Deploying the Sports Room system

Three parts: database (MongoDB Atlas), backend (Render or any Node host), frontend (Vercel or Netlify).
Do them in this order, because each one needs the address of the one before it.

## 1. Database: MongoDB Atlas
1. Create a free cluster. Database Access: add a user with a strong password.
2. Network Access: allow `0.0.0.0/0` (hosts like Render have no fixed address).
3. Connect, Drivers: copy the string and put the database name in it:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/sports-equipment`
   This is `MONGO_URI`.

## 2. Photos: Cloudinary (optional, needed for equipment photos)
Create a free account. From the dashboard copy Cloud name, API key and API secret.
Without them photo upload answers 503 and everything else works.

## 3. Email: Resend (optional, needed for "Forgot password" mails)
Create an API key at resend.com and set `EMAIL_API_KEY` and `EMAIL_FROM`.
Without a key the reset link is only printed in the backend log, so students cannot get it. Set it before real students use the system.

## 4. Backend (Render, Web Service)
- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Environment variables:

| Name | Value |
|---|---|
| `MONGO_URI` | the Atlas string from step 1 |
| `JWT_SECRET` | a long random string (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `JWT_EXPIRES_IN` | `7d` |
| `FRONTEND_URL` | your frontend address, e.g. `https://sports-room.vercel.app` (no trailing slash; several addresses: separate with commas) |
| `APP_TIMEZONE` | `Asia/Kolkata` |
| `EMAIL_API_KEY`, `EMAIL_FROM` | from step 3 |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | from step 2 |

`PORT` is set by the host. After deploy open `https://YOUR-BACKEND/api/health` : it must answer `success: true`.

Render free services sleep after inactivity, so the first request can take about a minute.

## 5. Frontend (Vercel or Netlify)
- Root directory: `frontend`
- Build command: `npm run build`, output directory: `dist`
- Environment variable: `VITE_API_URL` = `https://YOUR-BACKEND/api` (it must end in `/api`).
  Vite reads it at build time, so change it, then redeploy.
- Page refresh on `/admin/reports` etc. works because of `frontend/vercel.json` (Vercel) and
  `frontend/public/_redirects` (Netlify).

Now go back to the backend and set `FRONTEND_URL` to the real frontend address if you used a placeholder.

## 6. First data (once, from your laptop, with `MONGO_URI` of Atlas in `backend/.env`)
```bash
cd backend
node scripts/seedAdmin.js      # first admin account; change its password at first login
```
Then sign in as admin: add equipment types and units, create staff accounts, import students (CSV).
`seedEquipment.js` is for a development database only.

If this database came from the OLD system (single `equipment` collection), run once:
```bash
node scripts/migrateEquipmentToUnits.js --dry-run   # look first
node scripts/migrateEquipmentToUnits.js
```

## 7. Smoke test after every deploy
1. Open the frontend, log in as admin. The dashboard loads with no red error.
2. Refresh on `/admin/reports`: the page loads (no 404).
3. Student login, scan or open an item, request it. Staff approves. Student returns, staff confirms.
4. Forgot password for a student: the mail arrives, the link opens `/set-password` on the real address.
5. Equipment photo upload works.
6. Browser console shows no CORS error. If it does, `FRONTEND_URL` does not match the address in the browser bar exactly.

## Secrets
Never commit `.env`, student lists (`students.json`, CSV) or API keys. If a key was ever committed, change it at the provider.
