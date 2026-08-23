# Expense Manager

A multilingual, mobile-first expense splitting app for groups. Track shared costs across trips, households, or any group — with flexible split options and automatic settlement calculations.

**Status:** v0.4.0-beta · Active development · Not yet production-deployed

---

## Features

- **Group-based expense tracking** — create groups for trips, households, monthly budgets
- **Flexible splits** — equal, fixed amount per person, or percentage per person
- **Settlement calculations** — who owes whom, summarised across all group expenses
- **Email verification** — secure signup with SendGrid email + deep link confirmation (mobile deep link works; web `/verify-email` link is currently broken, see ROADMAP.md Phase 4/5d)
- **Multilingual** — English and French (EN/FR) throughout backend and frontend
- **Multi-currency** — ISO 4217 currency support per group

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile app | React Native (Expo) · TypeScript |
| Backend API | Express 5 · TypeScript · Node.js |
| Database | PostgreSQL 17 · Prisma ORM |
| Auth | JWT · bcrypt · email verification |
| Email | SendGrid (prod) · Nodemailer/Ethereal (dev) |
| i18n | i18next (EN/FR) |
| Testing | Jest (backend) · Vitest (frontend) · Playwright (E2E) |
| Infrastructure | Docker (local DB) · Azure (planned deployment) |

---

## Project Structure

```
expense-manager/
├── backend/          # Express API (port 4000)
├── frontend/         # React Native / Expo app (port 8081)
├── maestro-flows/    # Mobile UI automation tests
├── PROJECT_MEMORY/   # Persistent project context and decisions
├── ROADMAP.md        # Feature roadmap and planned phases
└── docker-compose.yml
```

---

## Prerequisites

- Node.js 18+
- Docker (for local PostgreSQL)
- Expo Go app on your phone (for mobile testing)
- SendGrid account (or use Ethereal for dev email)

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd expense-manager
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start the database

```bash
docker-compose up -d
```

### 3. Configure backend environment

```bash
cd backend
cp .env.example .env.local
# Edit .env.local with your values (see backend/ENVIRONMENT_SETUP.md)
```

Key variables to set in `.env.local`:

```env
DATABASE_URL=postgresql://admin:admin123@localhost:5432/expense_db?schema=public
JWT_SECRET=<min 32 chars, random>
SENDGRID_API_KEY=<your key>        # or omit to use Ethereal in dev
APP_FRONTEND_URL=http://<your-machine-ip>:8081   # for mobile testing on same WiFi
```

### 4. Run database migrations and seed

```bash
cd backend
npm run migrate
npm run seed
```

### 5. Configure frontend environment (optional)

The Android emulator / CI default (`10.0.2.2:4000/api`) is already committed in `frontend/.env.development` — no setup needed for emulator or CI use. Only needed for a **physical device**: see [`frontend/ENVIRONMENT_SETUP.md`](frontend/ENVIRONMENT_SETUP.md).

### 6. Start the app

```bash
# From repo root — starts both backend and frontend
npm start

# Or individually:
cd backend && npm run dev      # API on http://localhost:4000
cd frontend && npm start       # Expo on http://localhost:8081
```

Scan the QR code in the Expo CLI output with **Expo Go** on your phone (must be on the same WiFi as your machine).

---

## Running Tests

```bash
# Backend (Jest)
cd backend && npm test

# Frontend (Vitest)
cd frontend && npm test -- --run

# TypeScript check
cd backend && npx tsc --noEmit

# E2E (Playwright)
npm run test:e2e
```

---

## Development Workflow

This project is developed using the [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin) plugin's stages — `/ce-plan` → `/ce-work` → `/ce-code-review` → `/ce-compound`. See [`CLAUDE.md`](CLAUDE.md) → Workflow for the full process and [`PROJECT_MEMORY/`](PROJECT_MEMORY/) for current project state.

Never commit without:
- `/ce-code-review` approval
- Tests passing
- `npx tsc --noEmit` clean

---

## Environment Variables Reference

See [`backend/.env.example`](backend/.env.example) / [`backend/ENVIRONMENT_SETUP.md`](backend/ENVIRONMENT_SETUP.md) for backend setup including production/Azure deployment, and [`frontend/.env.example`](frontend/.env.example) / [`frontend/ENVIRONMENT_SETUP.md`](frontend/ENVIRONMENT_SETUP.md) for frontend setup (emulator/CI default vs. physical-device override).

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full feature roadmap including current stabilisation work (Phase 5) and planned Azure deployment (Phase 7).

---

## Deployment (current: free-tier cloud stack)

- **Backend:** [Render](https://render.com) free tier, service `expense-manager`, config in [`render.yaml`](render.yaml). Live at `https://expense-manager-udoo.onrender.com`. Sleeps after ~15min idle (30-50s cold start on next request). Deploys automatically on push to `master` (Render watches the repo).
- **Database:** [Neon](https://neon.tech) Postgres free tier, project "expense-manager", 0.5GB cap. Auto-suspends compute when idle; data persists. Run migrations against it the same way as local (`npm run migrate` in `backend/`, pointed at the Neon `DATABASE_URL`).
- **Mobile builds:** [EAS Build](https://docs.expo.dev/build/introduction/) (Android internal distribution, not Play Store). Config in [`frontend/eas.json`](frontend/eas.json). To build and test:
  ```
  cd frontend
  npx eas-cli build --platform android --profile preview
  ```
  EAS prints an install link when done (also at `expo.dev/accounts/navindalmia/projects/expense-manager/builds/<id>`) — open it on an Android phone to install the APK directly, no Play Store needed. The `preview` profile points at the live Render backend.
- **Email verification:** SendGrid env vars (`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`) are wired into `render.yaml` but **not yet set** — see [`backend/ENVIRONMENT_SETUP.md`](backend/ENVIRONMENT_SETUP.md). Until configured, verify test accounts manually via SQL in Neon's SQL Editor: `UPDATE "User" SET "emailVerified"=true WHERE email='...'`.
- **Debugging a failed EAS build:** if the dashboard just says "Unknown error", get the real log with `npx eas-cli build:view <build-id> --json` (gives a signed log URL) — see `docs/solutions/build-errors/render-eas-free-tier-deploy-setup.md` for the full troubleshooting steps (log is Brotli-compressed, needs `brotli -d`, not `gunzip`).

Azure was the original target (see ROADMAP.md Phase 7) but was deferred indefinitely 2026-08-01 in favor of this zero-spend stack.
