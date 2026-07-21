# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack expense management app: Express/TypeScript backend + React Native (Expo) frontend. Two independent workspaces under one git repo — not a monorepo with shared packages.

## Commands

### Root (run both services)
```powershell
npm start                  # Start backend (ts-node-dev) + frontend (Expo) concurrently
```

### Backend (`cd backend`)
```powershell
npm run dev                # Dev server with hot reload
npm test                   # Jest unit tests
npm run test:watch         # Jest watch mode
npm run test:coverage      # Coverage report
npx tsc --noEmit           # TypeScript check (run before any commit)
npm run generate           # Regenerate Prisma client after schema changes
npm run migrate            # Run pending Prisma migrations
npm run seed               # Seed database with test data
```

### Frontend (`cd frontend`)
```powershell
npm start                  # Expo start (web/mobile)
npm run android            # Android emulator
npm run ios                # iOS simulator
npm test -- --run          # Vitest single run
npm run test:ui            # Interactive Vitest UI
npm run test:coverage      # Coverage report
```

### E2E (root)
```powershell
npm run test:e2e           # Playwright tests
npm run test:e2e:ui        # Playwright UI mode
npm run test:e2e:debug     # Playwright debug mode
```

### Server restart (no permission needed)
```powershell
taskkill /F /IM node.exe   # Kill all Node processes
# Then restart backend and frontend
```

## Architecture

### Backend: `backend/src/`
```
controllers/   → HTTP handlers: validate input via Zod, call services, return responses
services/      → Business logic, DB queries via Prisma, email sending
routes/        → Express route registration
schemas/       → Zod validation schemas (used at controller boundary)
middlewares/   → Auth JWT verification, global error handler, i18n middleware
errors/        → AppError class: throw new AppError(message, statusCode, 'ERROR_KEY')
lib/           → Prisma client singleton, logger, utilities
locales/       → i18n translation files (en/, fr/) — all error messages use keys
__tests__/     → Unit tests mirroring src/ structure
```

Data flow: `Request → Route → Middleware (auth) → Controller (Zod validate) → Service (Prisma/email) → Response`

### Frontend: `frontend/src/`
```
screens/       → Screen-level components
components/    → Reusable UI components
services/      → API call functions (wrap axios)
api/           → Axios client setup (interceptors for JWT, 401 redirect)
context/       → AuthContext (JWT + user state), LanguageContext (EN/FR)
hooks/         → Custom hooks encapsulating logic
navigation/    → React Navigation stack config
__tests__/     → Vitest unit tests mirroring src/ structure
```

### Key cross-cutting concerns

**Authentication:** JWT stored in AsyncStorage → Axios interceptor reads it on every request → 401 auto-redirects to Login. Email verification uses DB tokens → deep link `expensemanager://verify-email?token=...` → `VerifyEmailScreen`.

**i18n:** Both backend and frontend support EN/FR. Backend errors throw `AppError` with an i18n key string, not a literal message. Never hardcode user-facing strings.

**Validation:** All request validation happens at the controller layer using Zod schemas from `schemas/`. Services assume valid input.

**Database:** PostgreSQL 17 via Docker (`docker-compose.yml`). Use Prisma transactions for any multi-step writes. Select only required fields to avoid N+1.

## Coding Rules

- **TypeScript strict mode** — no `any`, explicit annotations always
- **Error handling** — `throw new AppError('errors.someKey', 409, 'SOME_CODE')` not `new Error('...')`
- **Functions < 50 lines** — extract logic into helpers or services
- **Tests with every code change** — tests in `__tests__/` mirroring the file being tested
- **SOLID + DRY** — see `PROJECT_MEMORY/03-CODING_PATTERNS.md` and `PROJECT_MEMORY/05-QUALITY_STANDARDS.md`

## Workflow (Compound Engineering)

This repo's development process is driven by the [Compound Engineering plugin](https://github.com/EveryInc/compound-engineering-plugin), not a hand-rolled phase system. Use its stages in order:

1. `/ce-brainstorm` / `/ce-plan` — think before building
2. `/ce-work` — implement (still must pass `npx tsc --noEmit` and ship tests with the code, per Coding Rules above)
3. `/ce-code-review` — independent review; must pass before commit
4. `/ce-compound` — after solving anything non-trivial, capture the solution to `docs/solutions/` so future runs don't re-investigate it

`docs/solutions/` is the project's institutional memory (read by future `/ce-plan`, `/ce-ideate`, `/ce-debug`, `/ce-work` runs) — it lives in the repo, so it travels with the codebase across machines. `PROJECT_MEMORY/01-MASTER_STATE.md` is a separate, human-curated status summary — update it at feature boundaries, not continuously.

See `PROJECT_MEMORY/MIGRATIONS.md` for what this replaced and why.

**Markdown files that can be committed:** `.instructions.md`, `PROJECT_MEMORY/*.md`, `docs/solutions/*.md`, `START_HERE.md`, `.github/copilot-instructions.md`, source code, tests.

**Never commit:** `*_REVIEW*.md`, `*_PLAN*.md`, `SESSION_*.md`, `TEST_RESULTS*.md` — these are ephemeral working docs.

## Environment Variables

Backend (`.env` / `.env.local`):
```
DATABASE_URL              # PostgreSQL connection string
JWT_SECRET                # JWT signing key
JWT_EXPIRES_IN            # e.g. "24h"
SENDGRID_API_KEY          # Production email (falls back to nodemailer in dev)
NODE_ENV                  # development | production
PORT                      # Default 4000
APP_FRONTEND_URL          # Base URL for email deep links
APP_SCHEME                # Deep link scheme: expensemanager://
```

Frontend:
```
EXPO_PUBLIC_API_BASE_URL  # Backend API base (must be EXPO_PUBLIC_ prefix to be bundled)
```

## Key Reference Files

- `PROJECT_MEMORY/01-MASTER_STATE.md` — current feature status and what's in progress
- `PROJECT_MEMORY/03-CODING_PATTERNS.md` — code examples and patterns
- `PROJECT_MEMORY/05-QUALITY_STANDARDS.md` — quality gate checklist (feeds CE's `/ce-code-review` stage)
- `docs/solutions/` — Compound Engineering's institutional memory of past problems/fixes
- `START_HERE.md` — onboarding guide and known architectural issues
- `PROJECT_MEMORY/10-AI_COLLABORATION.md` — agreed AI agent patterns, autonomous vs approval boundaries, lessons learned
- `PROJECT_MEMORY/MIGRATIONS.md` — log of major workflow/tooling changes and why they were made
