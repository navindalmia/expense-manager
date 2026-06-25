# Expense Manager — Project Roadmap

A multilingual, mobile-first expense splitting and settlement app. Built for groups of people sharing costs — trips, households, shared bills — with fair split calculations and clear settlement summaries.

**Stack:** React Native (Expo) · Express 5 · TypeScript · PostgreSQL · Prisma · SendGrid · JWT  
**Target platforms:** iOS, Android, Web (via Expo)  
**Deployment target:** Azure (Container Apps + Static Web Apps + PostgreSQL)

---

## Current State: v0.4.0-beta

Production-grade auth and core expense flows are complete. The app is functional end-to-end on mobile (Expo Go). Email verification is implemented and tested. Not yet production-deployed.

---

## ✅ Phase 1 — Backend Foundation (Complete)

- Express 5 + TypeScript project structure
- PostgreSQL schema via Prisma ORM
- Layered architecture: Controller → Service → Prisma
- Centralized `AppError` + error middleware
- Zod validation at controller boundary
- i18next with EN/FR support (all error messages use translation keys)
- Jest (backend) + Vitest (frontend) test infrastructure

---

## ✅ Phase 2 — Mobile Frontend (Complete)

Chose React Native (Expo) over React/Vite — mobile-first decision.

- Expo project with TypeScript
- React Navigation (stack navigator)
- Axios client with JWT interceptor + 401 auto-redirect
- AuthContext + LanguageContext (global state)
- Custom hooks pattern for screen logic

---

## ✅ Phase 3 — Core Domain: Groups & Expenses (Complete)

- User registration, login (bcrypt + JWT)
- Group creation, editing, member management
- Invite members by email (creates placeholder user if unregistered)
- Expense CRUD: title, amount, category, currency, date, notes
- Split types: EQUAL, AMOUNT (per person), PERCENTAGE (per person)
- Real-time personal share calculation in UI
- Expense list with running balance and group totals
- Settlement screen: who owes whom, across all group expenses
- Soft deletes (`isActive` flag) — no hard deletes
- Multi-currency support (ISO 4217)
- Rate limiting on auth endpoints

---

## ✅ Phase 4 — Authentication & Email Verification (Complete)

- JWT authentication (stateless, 24hr expiry)
- Email verification flow: signup → SendGrid email → deep link → verified
- Secure token format (`vrf_` prefix, single-use, 24hr expiry)
- Mobile browser compatible verification link (HTTP → Expo deep link)
- Account lockout after failed login attempts
- `emailVerificationMiddleware` guards sensitive routes

---

## 🟡 Phase 5 — Stabilisation & Quality (In Progress)

The app works but has known gaps that must close before production.

### 5a. Test Suite (High Priority)
- [ ] Fix 48 failing backend tests (signup email service mocks)
- [ ] Restore full 235/235 passing
- [ ] Target: 80%+ coverage on backend services, 70%+ on frontend components
- [ ] Add E2E Playwright tests for critical auth + expense flows

### 5b. Authorization (Critical — Blocks Production)
- [ ] Enforce group membership checks on all expense/group routes
- [ ] Users must only access groups they belong to
- [ ] Expense edit/delete restricted to payer or group creator
- [ ] Remove any remaining hardcoded user IDs

### 5c. Missing UI Flows
- [ ] Delete expense (backend ready, frontend missing)
- [ ] Remove member from group (backend ready, frontend missing)
- [ ] Resend verification email screen
- [ ] Auto-focus amount field after category/date selection

### 5d. Known Bugs
- [ ] Settlement screen: rent expense missing from calculation (data flow bug)
- [ ] Cannot modify/remove members after adding them to split

---

## 📋 Phase 6 — Production Hardening (Planned)

### 6a. Data Model
- [ ] Migrate split data from parallel arrays (`splitAmount[]`, `splitPercentage[]`) to a proper `ExpenseSplit` junction table
- [ ] This eliminates the array-indexing complexity and enables proper relational queries (e.g. "total owed by user X across all groups")
- [ ] Write and test migration carefully — existing data must be preserved

### 6b. Observability
- [ ] Structured logging with correlation IDs (Winston)
- [ ] Request/response logging middleware
- [ ] Error alerting (Azure Application Insights or Sentry)

### 6c. Security Hardening
- [ ] Helmet.js headers audit
- [ ] CORS locked to known origins in production
- [ ] Secrets management via Azure Key Vault (not `.env` files)
- [ ] Dependency audit (`npm audit`) and automated updates

### 6d. API Quality
- [ ] OpenAPI/Swagger spec for all routes
- [ ] API versioning (`/api/v1/`)
- [ ] Pagination on list endpoints (expenses, groups)

---

## 🚀 Phase 7 — Deployment (Planned)

### Infrastructure (Azure Free Tier → Pay-as-you-go)
| Component | Service |
|-----------|---------|
| Backend API | Azure Container Apps |
| Frontend (web) | Azure Static Web Apps |
| Database | Azure Database for PostgreSQL |
| Email | SendGrid (existing) |
| Secrets | Azure Key Vault |
| Monitoring | Azure Application Insights |

### CI/CD (GitHub Actions)
- [ ] On PR: TypeScript check + full test suite
- [ ] On merge to `main`: build + deploy backend container
- [ ] On merge to `main`: build + deploy Expo web frontend
- [ ] Separate staging and production environments
- [ ] Database migration step in deploy pipeline (not manual)

### Mobile App Distribution
- [ ] Expo EAS Build for iOS and Android
- [ ] TestFlight (iOS) + Google Play Internal Testing track
- [ ] Production release after stabilisation phase complete

---

## 🔮 Phase 8 — Advanced Features (Future)

These are desirable but not on the critical path:

| Feature | Notes |
|---------|-------|
| Live currency exchange rates | Integrate open exchange rates API |
| Receipt photo attachments | Azure Blob Storage |
| Push notifications | Expo Notifications — settlement reminders |
| Dashboard analytics | Spending by category, trends over time |
| Recurring expenses | Monthly bills auto-created |
| Export to CSV/PDF | For tax or record keeping |
| Role-based group permissions | Admin vs member distinctions |

---

## Architectural Principles

- **Mobile-first** — React Native (Expo) targets iOS and Android; web is secondary
- **Multilingual by default** — all user-facing strings use i18n keys (EN/FR today, extensible)
- **Layered architecture** — Controllers validate, Services own business logic, Prisma owns data access
- **Fail loudly in dev, gracefully in prod** — `AppError` with structured codes, never raw `Error`
- **No hard deletes** — soft delete with `isActive` flag preserves audit trail
- **Tests with every code change** — no untested code reaches `main`

---

*Last updated: June 2026 — v0.4.0-beta*
