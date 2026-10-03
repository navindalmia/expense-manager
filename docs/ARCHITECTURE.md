# Architecture — Expense Manager

> End-to-end reference: stack, local dev, the write→merge pipeline (gates and CI), deployment, and data model — all in one place. Cross-checked against the actual repo files as of 2026-09-21 (not written from memory of what "should" be there). Where something is aspirational rather than live today, it's called out explicitly.
>
> This doc summarizes; it doesn't replace the source files. For status/roadmap detail see `PROJECT_MEMORY/01-MASTER_STATE.md` and `ROADMAP.md`; for past problem/fix investigations see `docs/solutions/`.

---

## 1. Overview & Stack

A multilingual (EN/FR), mobile-first expense-splitting app for groups. Two independent workspaces under one git repo (not a monorepo with shared packages): `backend/` (Express API) and `frontend/` (React Native/Expo app), plus root-level E2E (Playwright) and Maestro mobile flows.

| Layer | Technology | Source of truth |
|---|---|---|
| Mobile/web client | React Native 0.81 + Expo ~54 (SDK) · TypeScript · React 19 | `frontend/package.json` |
| Backend API | Express 5 · TypeScript (strict) · Node 20 (`ts-node-dev` in dev) | `backend/package.json` |
| Database | PostgreSQL 17 via Prisma ORM 6 | `backend/prisma/schema.prisma` |
| Auth | JWT (`jsonwebtoken`) + bcrypt, email verification via DB tokens | `backend/src/middlewares`, `backend/src/services` |
| Email | SendGrid (prod) · Nodemailer/Ethereal (dev) | `@sendgrid/mail`, `nodemailer` |
| i18n | i18next (EN/FR), backend errors thrown as translation keys | `backend/src/locales`, `i18next-fs-backend` |
| Validation | Zod (backend request schemas) | `backend/src/schemas` |
| Testing | Jest (backend unit) · Vitest (frontend unit) · Playwright (web E2E) · Maestro (mobile E2E) | see §3 |
| Navigation | React Navigation (native-stack) | `frontend/src/navigation` |
| Local infra | Docker Compose (Postgres only) | `docker-compose.yml` |
| Hosted infra | Render (backend), Neon (Postgres), EAS Build/Update (Android) | see §5 |

Version note: root `package.json` is `0.4.0`; README states `v0.4.0-beta`, "Not yet production-deployed" for a public release, though a live backend+DB+mobile-build pipeline does exist (§5).

---

## 2. Local Development

1. **Install** — `npm install` at root, then in `backend/` and `frontend/` separately (independent workspaces, no shared `node_modules` hoisting relied upon).
2. **Database** — `docker-compose up -d` starts local Postgres 17 (credentials in `docker-compose.yml`, matching `DATABASE_URL=postgresql://admin:admin123@localhost:5432/expense_db`).
3. **Backend env** — `cd backend && cp .env.example .env.local`, fill in `DATABASE_URL`, `JWT_SECRET` (min 32 chars), `SENDGRID_API_KEY` (optional — falls back to Ethereal), `APP_FRONTEND_URL` (LAN IP for mobile device testing). Full var list in `backend/ENVIRONMENT_SETUP.md`.
4. **Schema** — `cd backend && npm run migrate` (Prisma migrate dev) then `npm run seed` (reference data: currencies, categories — **not** users; users are created through the real signup flow, by design, per `backend/prisma/seed.ts`).
5. **Run both services** — `npm start` at root runs `concurrently`: backend (`ts-node-dev --respawn --transpile-only src/server.ts`, port 4000) + frontend (`expo start`, port 8081/19006).
6. **Frontend env** — `EXPO_PUBLIC_API_BASE_URL` must carry the `EXPO_PUBLIC_` prefix to be bundled into the client.
7. **Server restart** — no special permission needed: `taskkill /F /IM node.exe` (Windows) then restart both.

Test commands (used both locally and in CI):
```
backend:  npm test | npm run test:watch | npm run test:coverage | npx tsc --noEmit
frontend: npm test -- --run | npm run test:ui | npm run test:coverage
e2e:      npm run test:e2e (Playwright, root) | Maestro flows under maestro-flows/
```

---

## 3. The Write→Merge Pipeline

```mermaid
flowchart TD
    A[Developer writes code] --> B{git commit}
    B -->|PreToolUse hook| C[pre-commit-gate.js\ntsc --noEmit, every ts project]
    C -->|fail| A
    C -->|pass| D[pre-commit-quality-gate.js\nRule 1: UI change needs E2E file staged\nRule 2: fix(...) commit needs a test file staged]
    D -->|fail, no exempt trailer| A
    D -->|pass or exempt trailer| E[Commit created]
    E --> F[git push / PR opened]
    F --> G[GitHub Actions CI]
    G --> G1[backend-test: migrate + tsc + jest]
    G --> G2[frontend-test: tsc + vitest]
    G --> G3[e2e-web: Playwright against live backend+Postgres+Expo-web]
    G --> G4[e2e-mobile: Maestro on Android emulator, real backend+Postgres]
    G1 --> H{Required checks pass?}
    G2 --> H
    H -->|backend-test + frontend-test required| I[/ce-code-review dispatched — process step, not hooked/]
    I --> J[PR merged to master]
    J --> K[deploy-backend job\nneeds: backend-test, frontend-test\nruns only on push to master]
    K --> L[Render deploy triggered via API]
    J --> M[eas-build.yml\non push to master, frontend/** changed\nbuild + OTA update — separate workflow]
```

### 3a. Local hooks (mechanically enforced, run on every `git commit`)

Registered in `.claude/settings.json` as `PreToolUse` hooks on `Bash(git commit*)`. Both **fail open** (allow the commit) if they can't determine the target repo, staged files, or commit message — a broken environment never blocks unrelated commits.

- **`pre-commit-gate.js`** — blocks the commit unless `tsc --noEmit` passes for every TypeScript project found in the target repo (shallow scan: repo root + one level, wherever a `tsconfig.json` exists — i.e. `backend/` and `frontend/` independently). Skips entirely if no `tsconfig.json` exists, or if `typescript` isn't installed for a project (fails open with a warning, doesn't block).
- **`pre-commit-quality-gate.js`** — enforces two rules from CLAUDE.md/`PROJECT_MEMORY/05-QUALITY_STANDARDS.md`:
  - **Rule 1 (UI needs E2E):** if the staged diff touches `frontend/src/screens/**/*.tsx` or `frontend/src/components/**/*.tsx` (excluding `__tests__`/`*.test.tsx`), the diff must also touch something under `e2e/` or `maestro-flows/`, or the commit message must carry an `E2E-Exempt: <reason>` trailer.
  - **Rule 2 (bug-fix needs a test):** if the commit message starts with `fix(`, the diff must touch a test file (`__tests__/`, `e2e/`, or `*.test.ts(x)`), or the commit message must carry a `Test-Exempt: <reason>` trailer.
- There's also a **`PostToolUse` hook** on `Edit|Write` that injects a reminder (not a block) to run `tsc`, dispatch `/ce-code-review`, and run tests before committing — advisory only, not enforced.

### 3b. GitHub Actions CI (`.github/workflows/ci.yml`)

Triggers: every `pull_request`, and every `push` to `master`.

| Job | Triggers on | What it does | Required for merge? |
|---|---|---|---|
| `backend-test` | PR + push to master | Spins up Postgres 17 service container, `prisma migrate deploy`, `tsc --noEmit`, `jest` | **Yes** (per `PROJECT_MEMORY/01-MASTER_STATE.md` and `ROADMAP.md`) |
| `frontend-test` | PR + push to master | `npm install --legacy-peer-deps`, `tsc --noEmit`, `vitest run` | **Yes** |
| `e2e-web` | PR + push to master | Real Postgres + real backend on :4000 + real Expo web build on :8081, runs `e2e/intelligence-layer.spec.ts` via Playwright against the live stack (no mocks). Independent of backend-test/frontend-test (runs in parallel). New job (added ~2026-09-14) — explicit comment in `ci.yml` says **not yet made a required check** pending a longer stability track record. | **No (currently advisory)** |
| `e2e-mobile` | PR + push to master | Builds a debug APK, boots a real Android emulator (`reactivecircus/android-emulator-runner`), seeds real fixtures through the live API, runs 3 Maestro flows (login/group-list/expense-list) from `maestro-flows/visual/`. Runs in parallel, independent of backend-test/frontend-test. | **No, explicitly** — `ci.yml` has an inline comment saying this must *not* be a required check, because the runner action's own emulator-teardown step has a confirmed unfixable upstream bug that can make the job report `failure` even when all 3 Maestro flows genuinely passed (check the log for "3/3 Flows Passed" before trusting a red X here) |
| `deploy-backend` | push to `master` only (`needs: [backend-test, frontend-test]`) | Triggers a Render deploy via API call (`clearCache: do_not_clear`) | N/A — this *is* the deploy gate; see §5 |

Required-status-check enforcement itself lives in GitHub's branch-protection settings for `master`, which is a one-time manual UI setting outside any file in this repo (confirmed via `docs/plans/2026-08-22-001-feat-ci-visual-regression-a11y-gates-plan.md`, which flags this as a manual step "outside this plan's reach").

### 3c. Compound Engineering (CE) workflow — process-level, NOT git-hookable

CLAUDE.md states this sequence as mandatory for any non-trivial change (more than a one-line typo/config/rename fix):

1. `/ce-brainstorm` / `/ce-plan` — required before implementation on anything with real scope ambiguity; small well-specified fixes may skip straight to step 2, but that skip should be stated, not silent.
2. `/ce-work` — implementation; still must pass `tsc --noEmit` and ship tests with the code.
3. `/ce-code-review` — the actual specialist-reviewer skill (security, testing, maintainability, adversarial personas), dispatched every time, not a self-review substitute.
4. `/ce-compound` — after solving anything non-trivial, capture the solution to `docs/solutions/` so future work doesn't re-investigate it.

**What's mechanically enforced vs. not**, per CLAUDE.md's own explicit reasoning:
- **Hooked (hard-blocked):** `tsc --noEmit` passing (`pre-commit-gate.js`); real E2E coverage staged alongside UI changes, and a regression test staged alongside `fix(...)` commits (both via `pre-commit-quality-gate.js`, both escapable with an explicit exemption trailer).
- **Not hooked (self-discipline only):** whether `/ce-brainstorm`/`/ce-plan` actually happened before implementation; whether `/ce-code-review` was genuinely dispatched as the specialist skill versus simulated; whether `/ce-compound` ran after a real fix. None of these are detectable from a git diff, so none are hooked — CLAUDE.md states them as mandatory precisely *because* they can't be mechanically enforced, not because they are.

---

## 4. Deployment

**Backend — mostly automatic today.** `deploy-backend` in `ci.yml` runs only on a `push` to `master`, only after `backend-test` and `frontend-test` both pass, and triggers a Render deploy via Render's API (`RENDER_API_KEY` secret). Per an inline comment in `ci.yml`, this CI-triggered deploy **replaced Render's own auto-deploy webhook** (disabled 2026-08-22) specifically so a broken backend can never reach production regardless of what Render's own polling would otherwise do. Database is Neon (managed Postgres), referenced via `DATABASE_URL`.

Render/Neon/EAS free-tier setup had real gaps that had to be fixed by hand (`docs/solutions/build-errors/render-eas-free-tier-deploy-setup.md`, 2026-08-01):
- Render's dashboard **Build/Start Command fields are the actual source of truth** for a manually-created ("New Web Service") deploy — `render.yaml` committed to the repo is ignored unless the service was created as a Blueprint deploy. Keep both in sync by hand.
- Render's `NODE_ENV=production` skips devDependencies by default, so the build command must be `npm install --include=dev && npm run build` since `tsc`/`prisma`/`@types/jest` are all devDeps needed at build time.
- `frontend/.npmrc` sets `legacy-peer-deps=true` because EAS's strict `npm ci` fails on a real peer-dep conflict (`@testing-library/react` wants React 18, app runs React 19) that a local lenient `npm install` silently tolerates.

**Mobile (Android) — automatic build/update, but no store distribution.** `.github/workflows/eas-build.yml` runs on push to `master` when `frontend/**` changes (or manually via `workflow_dispatch`):
- `build` job: `tsc --noEmit` + `vitest run`, then `eas-cli build --platform android --profile preview --non-interactive --no-wait` — produces an installable APK (internal distribution, points at the live Render backend), not published to the Play Store.
- `update` job: runs in parallel, publishes a JS-only OTA update to the `preview` channel via `eas-cli update` — reaches already-installed builds immediately; native changes (new native modules, permission/SDK changes) still require installing a fresh APK from the `build` job.

No iOS CI and no Play Store distribution — both explicitly out of scope/deferred per `docs/plans/2026-08-22-001-...-plan.md` and the README's "Azure (planned)" note, which itself appears stale (actual infra is Render+Neon+EAS, not Azure — README's infra table should probably be updated to match `PROJECT_MEMORY/01-MASTER_STATE.md`).

**Summary — automatic vs. manual:**
| Path | Trigger | Automatic? |
|---|---|---|
| Backend deploy (Render) | Push to `master`, after CI passes | Automatic (CI-gated) |
| Android APK build (EAS) | Push to `master` touching `frontend/**`, or manual dispatch | Automatic, or on-demand manual |
| Android OTA update (EAS Update) | Same trigger as APK build | Automatic |
| Play Store / iOS release | — | Not implemented — manual/future only |

---

## 5. Data Model (brief orientation)

Source: `backend/prisma/schema.prisma`. Core entities:

- **User** — auth (bcrypt password, optional/nullable for invite-before-register), email verification state, lockout fields (`failedLoginAttempts`, `lockedUntil`). Owns groups it created, groups it's a member of, expenses it paid, and its own custom Themes/Categories/Labels.
- **Group** — the container for shared expenses (a trip, household, or recurring month). Has one creator, many members (`User[]`), one `Currency`, an optional `Theme` (links related groups, e.g. a recurring "Monthly Expense" group reused across months). Soft-deleted via `isActive`.
- **Expense** — belongs to one `Group`, paid by one `User`, split across `splitWith: User[]`. `splitType` (`EQUAL` | `AMOUNT` | `PERCENTAGE`) determines whether `splitAmount[]` or `splitPercentage[]` is meaningful (index-aligned with `splitWith`; see `PROJECT_MEMORY/07-SPLIT_ARRAY_ARCHITECTURE.md` for the indexing convention — this was also the subject of the current branch's fix, issue #46, where a payer excluded from a `PERCENTAGE` split must get a 0 share rather than inheriting the first member's percentage). Has one `Category`, an optional `Label`.
- **Category** — expense categorization (e.g. FOOD, TRAVEL). `userId: null` = system/seeded default, set = user-created custom category.
- **Theme** — group-level, reusable tag for linking related groups over time. Same null-vs-owned pattern as Category.
- **Label** — expense-level, free-text, cross-group tag (e.g. "Liverpool"). Currently always user-created in v1.
- **Currency** — ISO 4217 reference data (`code`, `label`), referenced by both `Group` and `Expense`.
- **EmailVerificationToken** — DB-backed signup verification tokens, cascade-deleted with the user.
- **CategorySuggestionAudit** — logs every keyword-dictionary category suggestion vs. what the user actually chose, for a possible future smarter-suggestion feature; not part of the core expense-tracking path.

Relationship shape at a glance: `User —< Group —< Expense >— User (split)`, with `Category`/`Label`/`Theme`/`Currency` as shared reference/tag tables hanging off `Expense`/`Group`.

---

## 6. Key Directories

```
backend/src/
  controllers/   HTTP handlers — Zod validation, calls services, shapes responses
  services/      Business logic, Prisma queries, email sending
  routes/        Express route registration (auth, groups, expenses, categories,
                  currencies, labels, themes, internal)
  schemas/       Zod validation schemas (controller boundary)
  middlewares/   JWT auth, global error handler, i18n
  errors/        AppError(message, statusCode, 'ERROR_KEY')
  lib/           Prisma client singleton, logger, utilities
  locales/       en/, fr/ translation files
  __tests__/     Jest unit tests mirroring src/

frontend/src/
  screens/       Screen-level components
  components/    Reusable UI components
  services/      API call wrappers (axios)
  api/           Axios client + interceptors (JWT attach, 401 redirect)
  context/       AuthContext, LanguageContext
  hooks/         Custom hooks
  navigation/    React Navigation stack config
  __tests__/     Vitest unit tests mirroring src/

e2e/                 Playwright specs (root)
maestro-flows/       Mobile UI automation (Maestro)
docs/solutions/       Compound Engineering's institutional memory — past problem/fix write-ups
docs/plans/            Planning docs from /ce-plan (ephemeral-ish, but kept for history)
PROJECT_MEMORY/        Human-curated status + standards docs (01-MASTER_STATE, 05-QUALITY_STANDARDS, etc.)
.claude/hooks/          pre-commit-gate.js, pre-commit-quality-gate.js (see §3a)
.github/workflows/      ci.yml, eas-build.yml (see §3b, §5)
```

---

## 7. Notable gaps / inconsistencies found while writing this doc

- **README's infra row says "Azure (planned deployment)"** — actual live infra is Render (backend) + Neon (Postgres) + EAS (Android), live since 2026-08-01 per `PROJECT_MEMORY/01-MASTER_STATE.md`. README appears stale on this point.
- **`e2e-web` and `e2e-mobile` are not required branch-protection checks**, only `backend-test`/`frontend-test` are — both explicitly, deliberately, for different reasons (e2e-web is too new to have a stability track record yet; e2e-mobile has a confirmed unfixable upstream flake in its emulator-teardown step). Don't assume a red X on either blocks merge.
- **`principles-audit` CI job does not exist in `ci.yml`** as checked (only `backend-test`, `frontend-test`, `deploy-backend`, `e2e-mobile`, `e2e-web`) — if this was expected to be live, it is not merged yet.
- **Branch protection (which checks are actually "required")** is a manual GitHub dashboard setting, not stored in this repo at all — this doc's "required" claims for `backend-test`/`frontend-test` rely on `PROJECT_MEMORY/01-MASTER_STATE.md` and `ROADMAP.md` asserting it was manually enabled, not on any file this doc can verify directly.
- **The `feat/intelligence-layer-...` branch** (Themes/Categories/Labels/autocomplete, referenced in recent commits) is fully tested locally per `01-MASTER_STATE.md` but explicitly **not yet wired into CI and has no PR open** — the Prisma schema in this doc already reflects it (it's merged into the schema file on disk), but treat that feature's CI coverage as not yet live.
