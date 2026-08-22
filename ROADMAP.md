# Expense Manager — Project Roadmap

A multilingual, mobile-first expense splitting and settlement app. Built for groups of people sharing costs — trips, households, shared bills — with fair split calculations and clear settlement summaries.

**Stack:** React Native (Expo) · Express 5 · TypeScript · PostgreSQL · Prisma · SendGrid · JWT  
**Target platforms:** iOS, Android, Web (via Expo)  
**Deployment target:** Azure (Container Apps + Static Web Apps + PostgreSQL)

---

## Current State: v0.4.0-beta

Core expense/group flows are complete and functional end-to-end on mobile (Expo Go). Email verification is implemented but the web verify link is broken (see Phase 4). Not yet production-deployed.

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

## 🟡 Phase 4 — Authentication & Email Verification (Partially Working)

**Status update (2026-08-16, commit `421c575`):** the "new user has no working path to join" blocker is resolved. On the live Render deployment, `REQUIRE_EMAIL_VERIFICATION=false` (SendGrid isn't configured there) — signup and login now correctly skip verification when the flag is off, mirroring each other, so a new user is logged in immediately after signup instead of being stranded on a dead-end "check your email" screen. See `docs/solutions/logic-errors/signup-always-shows-check-email-regardless-of-verification-flag.md`. No longer the top priority; the remaining items below are lower-priority follow-ups, relevant mainly if `REQUIRE_EMAIL_VERIFICATION` is ever flipped to `true` in production.

- [x] JWT authentication (stateless, 24hr expiry)
- [x] Secure token format (`vrf_` prefix, single-use, 24hr expiry)
- [x] Account lockout after failed login attempts
- [x] `emailVerificationMiddleware` guards sensitive routes
- [x] Signup/login correctly skip verification when `REQUIRE_EMAIL_VERIFICATION=false` — fixed 2026-08-16, commit `421c575`
- [ ] **Still broken, lower priority:** web `/verify-email?token=...` route doesn't call the verify API — falls back to Login silently. Only matters if verification is ever required in production. Regressed when deep-linking config was removed to fix a `NavigationContainer` crash on web; never re-wired.
- [ ] SendGrid not configured in dev — flow untested end-to-end
- Current dev workaround: a pre-verified test user is inserted directly into the DB (`test@test.com` / `Test1234!`)

---

## 🟡 Phase 5 — Stabilisation & Quality (In Progress)

The app works but has known gaps that must close before production.

### 5a. Test Suite (High Priority)
- [ ] Backend and frontend suites have drift (stale tests vs. moved code, not regressions) — get both to a clean green baseline
- [ ] Target: 80%+ coverage on backend services, 70%+ on frontend components
- [ ] Add E2E Playwright tests for critical auth + expense flows
- [ ] Add CI (GitHub Actions) so drift is caught immediately instead of accumulating (see 7 — CI/CD)
- [ ] **Unverified:** `maestro.yaml` + `maestro-flows/` (mobile E2E for email verification, 8 flows) added 2026-05-20, never wired into any npm script or CI, and never confirmed to actually run. Treat as untrusted until someone validates the `maestro` CLI setup and runs a flow end-to-end. Note: these flows test the *native* deep link (`expensemanager://verify-email/<token>`), not the *web* route (`/verify-email?token=...`) that's confirmed broken above — no coverage exists for the web bug either way. Pairs with `mcp-database-server/` (read-only Postgres query tool for verifying DB state during these flows — see its README) — also unverified/unwired for the same reason.

### 5b. Authorization (Verified 2026-07-26 — Complete)
- [x] Enforce group membership checks on all expense/group routes — `expenseService.ts` and `groupService.ts` both gate on `isMember || isCreator`, throwing 403 otherwise
- [x] Users must only access groups they belong to
- [x] **Clarified 2026-07-26:** any group member can edit/delete any expense in that group — no payer/creator-only restriction. Membership is the only gate; non-members get no access at all.
- [x] Remove any remaining hardcoded user IDs — all controllers derive `userId` from `req.user!.id` (JWT); only remaining `userId = 1` occurrences are test fixtures in `emailVerificationService.test.ts`

### 5c. Missing UI Flows
- [x] ~~Delete expense (backend ready, frontend missing)~~ — **shipped** (commit `cd3305c`): delete-expense UI added, using the backend endpoint that already existed unused.
- [ ] Remove member from group (backend ready, frontend missing)
- [ ] Resend verification email screen
- [ ] Auto-focus amount field after category/date selection
- [ ] Group detail view doesn't show the current user's total personal split/debt for that group
- [ ] **Logged 2026-08-16 (mobile screenshot review):** expense cards on the Group Expenses screen don't show who paid — with several members, it's not clear at a glance whose expense is whose. Add a "paid by <name>" label to each card.

### 5d. Known Bugs
- [ ] Fix web `/verify-email` route (see Phase 4)
- [ ] Settlement screen: rent expense missing from calculation (data flow bug) — **investigated 2026-07-24**: not reproducible in `SettlementScreen.tsx`'s calculation logic itself (see `src/screens/__tests__/SettlementScreen.test.tsx`); a rent-category expense present in `route.params.expenses` is included correctly. If still real, the bug is upstream — in whatever populates `expenses` before navigating to this screen — not yet traced.
- [ ] Cannot modify/remove members after adding them to split
- [x] ~~~15 `Alert.alert(...)` call sites are silent no-ops on web~~ — the destructive "Remove Member" confirm in `AddMemberModal.tsx` is **fixed** (PR [#2](https://github.com/navindalmia/expense-manager/pull/2), merged 2026-07-27): swapped to `confirmThenProceed` in `crossPlatformAlert.ts` (`window.confirm` on web / `Alert.alert` on native), browser-verified end-to-end. The other ~14 `Alert.alert` call sites are still unaudited.
- [x] ~~[Issue #3](https://github.com/navindalmia/expense-manager/issues/3): `EditGroupModal` never shows existing group members directly~~ — **fixed** (PR [#7](https://github.com/navindalmia/expense-manager/pull/7)): `EditGroupModal` now renders `group.members` inline.
- [ ] **[Issue #4](https://github.com/navindalmia/expense-manager/issues/4):** Create/Edit Expense split amounts don't update live when typing the Amount field — stale `React.memo` comparator on `SplitMembersInput` missing `totalAmount`. Data saves correctly; display-only bug.
- [ ] **[Issue #5](https://github.com/navindalmia/expense-manager/issues/5):** "Share via WhatsApp" sends a plain text message with no invite link/token — recipient has no actual way to join the group. Needs real invite-link infrastructure, not just a frontend tweak.
- [x] ~~[Issue #6](https://github.com/navindalmia/expense-manager/issues/6): Create Expense `category` field defaults to `null` and hard-blocks saving~~ — **fixed** (PR [#7](https://github.com/navindalmia/expense-manager/pull/7)): defaults to "Other" in `EditExpenseScreen.tsx` (the screen navigation actually uses — the initial attempt at this fix touched dead code in `CreateExpenseScreen.tsx`, which nothing ever navigates to). Auto-classify-from-title stretch goal not attempted.
- [x] **Fixed** (PR [#7](https://github.com/navindalmia/expense-manager/pull/7)): EQUAL-split share calculation added a phantom `+1` to the divisor whenever the payer was excluded from the split (e.g. a £50/2-person split showed £16.67 instead of £25.00), duplicated across `ExpenseListScreen.tsx`, `SettlementScreen.tsx`, and backend `groupService.ts` (5 spots total). Also: "Paid By" now defaults to the logged-in user, and the payer is included in the split by default instead of auto-excluded.
- [x] **Fixed** (PR [#7](https://github.com/navindalmia/expense-manager/pull/7)): Android Save/Cancel buttons overlapped the system gesture-nav bar — wired up `react-native-safe-area-context` (installed but unused) in place of React Native's built-in `SafeAreaView`.
- [x] **Fixed 2026-08-01** (branch `fix/split-live-update-and-member-edit`, commits `f976cfa`..`88a1aba`): Issue #4 (split not updating live), member add/remove touch-target conflict, EQUAL/PERCENTAGE split rounding not summing to total (frontend + backend), `updateExpense` silently dropping the split on amount/percentage-only edits, member add/remove overwriting other members' manual split edits, 0-value "ghost" split members passing validation, individual negative split values bypassing sum validation, Settlement screen showing USD for non-USD groups, and editing an existing AMOUNT/PERCENTAGE split showing 0 instead of saved values. Full detail: `docs/solutions/logic-errors/equal-and-percentage-split-rounding-does-not-sum-to-total.md`.
- [ ] **Logged 2026-08-01, not yet investigated** (mobile QA, same session as above): (1) "split is not showing" on some screen — Navin's exact words, screen/repro not yet confirmed; (2) group/expense-list summary card showing spent amount as 0 even when expenses exist; (3) deselecting then reselecting a split member changes the displayed default from "0.00" to "0" (formatting inconsistency between `computeEqualAmounts`'s `.toFixed(2)` output and `addMember`'s raw `'0'` default); (4) Navin's suspicion that "spent was never showing 0 earlier" — i.e. a possible regression introduced by the same-session split-calc fixes above, not confirmed. **Explicitly not investigated further this session at Navin's request ("stop, log these, wrap up") — start here next session with fresh repro steps before touching split-calc code again.**

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
- [x] Dependency audit and automated updates — Dependabot added 2026-08-22 (`.github/dependabot.yml`), weekly, covers npm deps + GitHub Actions versions
- [ ] **Known gap, not covered by Dependabot:** the literal `node-version: "20"` pins inside `.github/workflows/*.yml` won't auto-update when Node 20 reaches end-of-life (~2026-2027) — Dependabot doesn't parse that string as a version reference. Needs a periodic manual/AI-assisted check (roughly annual, matching Node's LTS cadence) rather than an automated mechanism. Logged 2026-08-22.

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
| AI expense Q&A | Natural-language analytics over the user's own ring-fenced expense data. Text-to-query over structured data, not data entry. Open-ended by design — no fixed query set, since needs vary user to user and time to time. Must handle: (1) fuzzy/intelligent item-name matching (e.g. "surfshark" should also surface "surf"/"shark" partial matches, not just exact string), (2) time-scoped lookups ("when did I last spend on X", "how much yearly on X"). Accuracy of fuzzy matching and correctness of returned totals/dates are the two things to eval against (see evals note below). **Hard constraint: LLM must only translate the question into a structured query (Prisma/SQL) — the DB computes totals/dates/aggregates, never the LLM.** No non-deterministic output for numbers or dates; LLM output limited to query construction (and optionally phrasing the final answer around DB-returned facts). Depends on Phase 5 (stable data layer, green tests) landing first. |
| Audit log / activity history | Visible history of who changed what on an expense or group (created/edited/deleted, old → new values, timestamp). Does **not** restrict who can edit — any group member can still edit/delete any expense in that group (see 5b); this only makes changes traceable after the fact, not gated. |
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

*This file tracks scope and status, not dates or session logs — see `git log` for history.*
