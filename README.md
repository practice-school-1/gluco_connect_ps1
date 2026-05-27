# GlucoConnect

A diabetes management platform connecting patients and doctors. Patients log glucose, meals, and activities; doctors monitor, prescribe, and generate clinical reports — all in real time.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [API Reference](#api-reference)
- [Portals](#portals)
- [Insight Engine](#insight-engine)
- [Cron Job](#cron-job)
- [Team Guidelines](#team-guidelines)

---

## Overview

| | |
|---|---|
| **Type** | 7-week POC |
| **Scale** | 5 doctors · 25 patients |
| **Deadline** | July 10, 2026 |
| **Backend** | NestJS · PostgreSQL · Prisma |
| **Frontend** | Standalone HTML SPAs (no build step) |
| **Port** | 3000 |

---

## Tech Stack

- **Backend** — NestJS 10, TypeScript, Prisma 5, PostgreSQL 15
- **Auth** — JWT (24h expiry), OTP for patients, email+password for doctors
- **Scheduling** — `@nestjs/schedule` cron job (weekly summaries)
- **Frontend** — Vanilla JS, Chart.js 4.4.4, CSS variables, dark mode
- **Validation** — `class-validator` + `class-transformer`

---

## Project Structure

```
gluco_connect_ps1/
├── backend/
│   ├── main.ts                  # Bootstrap, CORS (origin *)
│   ├── app.module.ts            # Root module
│   ├── auth.ts                  # OTP + email/password auth, JWT
│   ├── profiles.ts              # Patient & Doctor profiles, invite codes
│   ├── health-tracking.ts       # Glucose, Meals, Activities, Summary
│   ├── clinical-care.ts         # Alerts, Insights, Medications, Notes, Reports
│   ├── foods.ts                 # 50 Indian foods with GI values
│   ├── export.ts                # CSV export
│   ├── cron.ts                  # Weekly summary cron (every Sunday 11pm)
│   ├── integrations.ts          # Device integrations (stub)
│   ├── prisma/
│   │   ├── schema.prisma        # 16 models
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   ├── package.json
│   └── tsconfig.json
├── patient_portal.html          # Patient SPA
├── doctor_portal.html           # Doctor SPA
└── docs/
    └── PROJECT_DIARY.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 15 running on `localhost:5432`

### Database Setup

```bash
sudo -u postgres psql
CREATE USER glucoconnect WITH PASSWORD 'yourpassword';
CREATE DATABASE glucoconnect_db OWNER glucoconnect;
\q
```

### Backend

```bash
cd backend
npm install
npx prisma db push          # creates all 16 tables
npx tsc --noEmit            # verify TypeScript
npm run start:dev           # starts on port 3000
```

### Frontend

No build step needed. Open the HTML files directly or serve them:

```bash
# from repo root
npx serve .
# or
python3 -m http.server 8080
```

---

## Environment Variables

Create `backend/.env` (not committed — see `backend/.env.example`):

```env
DATABASE_URL="postgresql://glucoconnect:yourpassword@localhost:5432/glucoconnect_db"
JWT_SECRET="change-this-in-production"
```

---

## Database

16 Prisma models: `User`, `Patient`, `Doctor`, `GlucoseReading`, `Meal`, `MealItem`, `Activity`, `Alert`, `Insight`, `Medication`, `MedicationLog`, `Note`, `Food`, and supporting models.

**Doctor–Patient linking:** Each doctor has a unique 6-character `invite_code` generated at profile creation. Patients link to their doctor by POSTing this code to `POST /patients/link-doctor`.

After any schema change:

```bash
npx prisma db push
npx prisma generate
```

---

## API Reference

Base URL: `http://localhost:3000`  
All endpoints except auth require: `Authorization: Bearer <token>`

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/send-otp` | Send OTP to patient phone (logged to console in dev) |
| POST | `/auth/verify-otp` | Verify OTP → returns JWT |
| POST | `/auth/login` | Doctor email+password login → returns JWT |
| POST | `/auth/register/doctor` | Register new doctor account → returns JWT |

### Profiles

| Method | Path | Description |
|--------|------|-------------|
| POST | `/patients/profile` | Create patient profile |
| GET | `/patients/profile` | Get own profile |
| PATCH | `/patients/profile` | Update own profile |
| POST | `/patients/link-doctor` | Link to doctor via `{ invite_code }` |
| POST | `/doctors/profile` | Create doctor profile |
| GET | `/doctors/profile` | Get own profile + invite code |
| PATCH | `/doctors/profile` | Update doctor profile |
| GET | `/doctors/patients` | Enriched patient list (latest glucose + alert count) |

### Glucose

| Method | Path | Description |
|--------|------|-------------|
| POST | `/glucose` | Log reading (`value_mg_dl`, `reading_type`, `recorded_at` required) |
| GET | `/glucose` | Last 30 days. Doctor: add `?patient_id=` |
| GET | `/glucose/history` | Daily avg/min/max grouped. Params: `?days=&patient_id=` |
| GET | `/glucose/time-in-range` | TIR%, in/below/above range counts. Param: `?days=` |
| GET | `/glucose/:id` | Single reading |
| PATCH | `/glucose/:id` | Edit reading |
| DELETE | `/glucose/:id` | Delete reading |

`reading_type` enum: `fasting` · `post_meal` · `random` · `bedtime`

### Meals

| Method | Path | Description |
|--------|------|-------------|
| POST | `/meals` | Log meal with `meal_items[]` array |
| POST | `/meals/analyze-photo` | Stub AI photo analysis |
| GET | `/meals` | Last 30 days. Doctor: add `?patient_id=` |
| GET | `/meals/:id` | Single meal with items |
| PATCH | `/meals/:id` | Update notes |
| DELETE | `/meals/:id` | Delete meal |

`meal_type` enum: `breakfast` · `lunch` · `dinner` · `snack`

### Activities

| Method | Path | Description |
|--------|------|-------------|
| POST | `/activities` | Log activity |
| GET | `/activities` | Last 30 days. Doctor: add `?patient_id=` |
| GET | `/activities/summary` | Daily step/calorie totals for last 7 days |
| GET | `/activities/:id` | Single activity |
| PATCH | `/activities/:id` | Update activity |
| DELETE | `/activities/:id` | Delete activity |

`intensity` enum: `low` · `moderate` · `high` · `very_high`

### Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/summary/daily` | Glucose + meals + activities combined. Param: `?date=YYYY-MM-DD` |
| GET | `/summary/weekly` | Last 7 days stats with per-day breakdown |

### Alerts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/alerts` | All alerts for patient |
| GET | `/alerts/unresolved` | Unresolved alerts only |
| PATCH | `/alerts/:id/resolve` | Mark resolved (doctor) |

### Insights

| Method | Path | Description |
|--------|------|-------------|
| GET | `/insights` | All insights (last 30 days) |
| GET | `/insights/daily` | Generate + return today's insight |
| GET | `/insights/weekly` | Generate + return this week's insight |
| PATCH | `/insights/:id/dismiss` | Dismiss an insight |

### Medications & Adherence

| Method | Path | Description |
|--------|------|-------------|
| POST | `/medications` | Prescribe medication (doctor, requires `patient_id`) |
| GET | `/medications` | All active medications |
| GET | `/medications/:id` | Single medication |
| PATCH | `/medications/:id` | Update medication |
| DELETE | `/medications/:id` | Delete medication |
| POST | `/medications/:id/log` | Log dose taken/skipped |
| GET | `/medications/:id/adherence` | Last 7 days adherence logs |
| GET | `/medications/adherence/today` | All meds with today's taken/skipped status |

### Notes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/notes` | Create clinical note (doctor, requires `patient_id`) |
| GET | `/notes` | All notes |
| PATCH | `/notes/:id` | Update note |
| DELETE | `/notes/:id` | Delete note |

### Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/pre-visit/:patientId` | 7-day glucose stats, alerts, meds, recent notes |
| GET | `/reports/weekly/:patientId` | Weekly: avg glucose, TIR%, avg steps, medications |
| GET | `/reports/monthly/:patientId` | Monthly (30-day): same structure as weekly |

### Foods

| Method | Path | Description |
|--------|------|-------------|
| GET | `/foods` | All 50 Indian foods. Param: `?query=` for search |
| GET | `/foods/:id` | Single food item |

Search matches both English name and regional name (case-insensitive).

### Export

| Method | Path | Description |
|--------|------|-------------|
| GET | `/export/patient-report` | CSV export for a patient. Doctor only. Params: `?patient_id=&days=` |
| GET | `/export/my-data` | Patient exports own data as CSV. Param: `?days=` |

Both return `Content-Disposition: attachment` — triggers a file download.

---

## Portals

### Patient Portal (`patient_portal.html`)

Dark-mode SPA. Auth via phone OTP.

| Page | Features |
|------|----------|
| Dashboard | Stat cards, 24h glucose chart (Chart.js), medication checklist, daily insight |
| Log Glucose | Reading type, value, time, notes |
| Log Meal | Meal type, Indian food search with GI badges, meal items |
| Log Activity | Type, steps, duration, intensity |
| Medications | Today's dose checklist (Taken/Skip), active prescriptions |
| Insights | Insight cards colored by flag, unresolved alerts |
| History | Glucose, meals, activities tables (last 30 days) |
| Profile | Personal info, health goals, doctor invite code linking |

### Doctor Portal (`doctor_portal.html`)

Dark-mode SPA. Auth via email + password, with registration flow.

| Page | Features |
|------|----------|
| Overview | Patient/alert/medication/note counts, recent alerts, recent notes |
| Patients | Patient grid cards with latest glucose + alert badge |
| Patient Detail | 6 tabs: Glucose chart (min/avg/max), Meals, Activities, Medications, Reports, Notes |
| Prescribe | Medication form: name, dosage, frequency, route, dates |
| Reports | Pre-visit report, weekly report per patient |
| Export | CSV download button per patient |
| Profile | Doctor info, invite code display |

---

## Insight Engine

10-rule engine in `clinical-care.ts`. Evaluates the last 24h (daily) or 7 days (weekly) of patient data. First matching rule wins.

| Rule | Condition | Flag |
|------|-----------|------|
| `hypo_risk` | Any reading < 70 mg/dL | `critical` |
| `very_high` | Any reading > 250 mg/dL | `warning` |
| `fasting_high` | Fasting reading > 126 mg/dL | `warning` |
| `post_meal_spike` | Post-meal reading > 180 mg/dL | `warning` |
| `pre_meal_elevated` | Pre-meal reading > 130 mg/dL | `warning` |
| `missed_logging` | Zero readings today | `info` |
| `low_activity` | Steps < 2,000 | `info` |
| `good_activity` | Steps ≥ 8,000 | `info` |
| `good_control` | All readings within target range | `info` |
| `no_readings` | No readings at all (fallback) | `info` |

`flag` values: `info` · `warning` · `critical`

---

## Cron Job

Runs every **Sunday at 11:00 PM** (`0 23 * * 0`).

For each active patient:
1. Checks if a weekly summary was already generated this week — skips if so
2. Queries last 7 days of glucose and activity data
3. Calculates TIR%, average glucose, average daily steps, total carbs
4. Saves an `Insight` record with `insight_type: weekly_summary`, `generated_by: cron_job`

---

## Team Guidelines

- **No direct pushes to `main`** — create a branch (e.g., `feature/login`) and open a PR
- **Branch scope** — keep work inside `backend/`, `patient-app/`, or `doctor-portal/` folders
- **PRs** — require at least one review before merging
- **Schema changes** — run `npx prisma db push` after editing `schema.prisma`, commit the updated schema file
- **TypeScript** — run `npx tsc --noEmit` before pushing; zero errors required
- **`.env`** — never commit secrets; update `.env.example` if you add a new variable
