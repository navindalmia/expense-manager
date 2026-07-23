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

### 5. Start the app

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

See [`backend/.env.example`](backend/.env.example) for all variables with descriptions, and [`backend/ENVIRONMENT_SETUP.md`](backend/ENVIRONMENT_SETUP.md) for setup instructions including production/Azure deployment.

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full feature roadmap including current stabilisation work (Phase 5) and planned Azure deployment (Phase 7).

---

## Deployment Target

Azure — Container Apps (backend) · Static Web Apps (frontend) · PostgreSQL Flexible Server · SendGrid. CI/CD via GitHub Actions. See ROADMAP.md Phase 7 for the full plan.
