# iMarc Attendance System

A GPS-verified staff attendance web app for iMarcProjects. Staff clock in/out from
their own phone; the system checks their location against a fixed office geofence.
Admin gets a live dashboard, an editable attendance log, on-demand Excel export, and
an automatic monthly report emailed to imarcprojects1@gmail.com.

Built per the PRD: single-phase build, one office location, browser GPS, manual staff
entry, Next.js + Postgres (Supabase), hosted on Render.

## Local setup

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL and DIRECT_URL at minimum to run locally
npx prisma db push        # creates tables from prisma/schema.prisma
npx prisma db seed        # creates the first admin login
npm run dev
```

Sign in at `/login` with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from your `.env`,
then change the password in Settings (password change is done via the Staff/Admin
record directly for now — see "Next steps" below if you want a self-service page).

Add staff from **Admin → Staff → Add staff**. They sign in at `/login` with the
login ID and password you set for them, and land on `/clock`.

## Deploying to Render + Supabase

The app runs as a Render Web Service; Postgres is hosted on Supabase (not Render's
own Postgres — its free tier is hard-deleted after 30 days, while a Supabase free
project only pauses after a week of inactivity and can be resumed from the dashboard
or an API ping).

1. **Push this project to a GitHub repo.**

2. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier).
   Save the database password you set — Supabase only shows it once.

3. **Get two connection strings** from Project Settings → Database → Connection
   string:
   - **Transaction pooler** (port 6543) → this is `DATABASE_URL`. Append
     `?pgbouncer=true`.
   - **Session pooler** (same pooler host, port 5432) → this is `DIRECT_URL`, used
     only for schema pushes. Don't use the `db.<ref>.supabase.co` direct host —
     it's IPv6-only unless you've bought the IPv4 add-on, and most networks (and
     Render's build environment) can't reach it.

4. **Create a Web Service** in Render, pointing at the repo.
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Environment: Node

5. **Set environment variables** on the Web Service (Render → Environment):
   - `DATABASE_URL`, `DIRECT_URL` — the two Supabase connection strings from step 3
   - `AUTH_SECRET` — any long random string
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — for
     imarcprojects1@gmail.com, use a Gmail **app password**, not the normal
     account password (Google Account → Security → App passwords)
   - `CRON_SECRET` — any long random string, must match the cron job below
   - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` — only needed for the one-time seed

6. **Run the first migration + seed.** After the first deploy, open the Web
   Service's Shell tab in Render and run:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

7. **Set the office location and late threshold.** Sign in as admin, go to
   Settings, click "Use my current location" while on-site (or standing wherever
   you're testing from), set the radius, and confirm the late threshold (defaults
   to 08:21, per the PRD).

8. **Create the monthly report Cron Job.** Render Dashboard → New → Cron Job:
   - Command: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<your-app>.onrender.com/api/reports/monthly`
   - Schedule: `0 6 1 * *` (6am on the 1st of every month — adjust timezone as needed)
   - Environment variable: `CRON_SECRET` set to the same value as on the Web Service

That's the whole deployment. No other services or add-ons are required.

## How the pieces map to the PRD

- **Clock in/out + geofencing** — `app/clock/page.tsx`, `app/api/clock/route.ts`, `lib/geo.ts`
- **Admin dashboard** — `app/admin/*`
- **Excel export** — `app/api/export/route.ts`, `lib/excel.ts`
- **Monthly report** — `app/api/reports/monthly/route.ts`, `lib/report.ts`, triggered by the Render Cron Job
- **Settings (geofence radius, late threshold, report email)** — `app/admin/settings/page.tsx`

## Notes

- Attendance data lives in Postgres — it's the system of record. Excel files are
  generated fresh on request, never stored on the server's disk (Render's disk is
  ephemeral and would lose files on redeploy).
- A day with no clock-in for an active staff member counts as absent in the
  monthly report; a day with a clock-in but no clock-out is flagged as an anomaly
  rather than silently ignored.
- This is a single-phase build per the PRD — there's no built-in multi-site
  support, self-registration, or a third user role. If you want to reuse this for
  another site later, that geofence logic already supports multiple locations
  under the hood (`lib/geo.ts`), it just isn't wired into the UI yet.
