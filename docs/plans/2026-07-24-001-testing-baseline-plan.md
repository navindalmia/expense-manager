---
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
---

# Testing Baseline & Priority Coverage - Plan

## Goal Capsule

**Objective:** Restore a trustworthy Jest (backend) and Vitest (frontend) test baseline, then close the highest-risk zero-coverage gaps — without chasing a global coverage percentage.

**Product authority:** Session-verified findings (test runs, coverage reports, code inspection performed 2026-07-24) — no existing STRATEGY.md or CONCEPTS.md in this repo.

**Open blockers:** None. Scope, sequencing, and success criteria are settled below.

## Product Contract

### Problem

`ROADMAP.md` Phase 5a claims backend/frontend test suites have "drift" and targets 80%/70% coverage. This session verified the drift claim as accurate and found the actual state significantly worse than the roadmap implies:

- **Backend (Jest):** 11 test files, 237 tests. 33 failing across 6 suites (auth login/signup, `jwtHelper`, `expenseService`, `expenseController`, `authService.complete`). Failures are stale assertions against old behavior (e.g. a test expects error code `ACCOUNT_INACTIVE`, service now returns `EMAIL_NOT_VERIFIED`; a `failedLoginAttempts` increment assertion no longer fires), not confirmed new product bugs. Coverage: 25.7% statements / 16.77% branches.
- **Backend zero-coverage files:** `groupService.ts` (879 lines — contains all group/expense `isMember`/`isCreator` authorization checks), `groupController.ts`, `categoryController.ts`, `currencyController.ts`, `emailVerificationMiddleware.ts`, `errorHandler.ts`, `rateLimitMiddleware.ts`.
- **Frontend (Vitest):** only 3 test files exist in total (`emailVerificationService`, `expenseService`, `splitValidation`) — zero coverage of screens, components, hooks, context, or navigation. `@vitest/coverage-v8` was missing from `devDependencies` entirely — the `test:coverage` script had never successfully run in this repo. Now installed (`--legacy-peer-deps`, due to a pre-existing React version peer conflict unrelated to this change).
- **Frontend broken tests:** `expenseService.test.ts` and `emailVerificationService.test.ts` mock `axios.create()`'s return value incorrectly, causing unhandled promise rejections that crash the coverage run before a report is written. 4 of 42 tests fail for the same root cause.
- **Roadmap Phase 5b** claims authorization is "Critical — Blocks Production" and still open. Code inspection found `isMember`/`isCreator` guards already implemented throughout `groupService.ts` and `expenseService.ts` — but because `groupService.ts` has 0% test coverage, this cannot be confirmed or denied from tests. This is the single highest-risk untested surface in the codebase.

Without a trustworthy baseline, nobody can tell whether a red test means a real regression or stale scaffolding, and the app's authorization logic — the thing standing between one user's data and another's — has never been exercised by a test.

### Scope

**In scope:**
1. Fix the 33 failing backend Jest tests (update stale assertions to match current service behavior; do not change service behavior to match old tests unless investigation shows the service is actually wrong).
2. Fix the 2 broken frontend test files (`expenseService.test.ts`, `emailVerificationService.test.ts`) by correcting the `axios.create()` mock setup.
3. Confirm `@vitest/coverage-v8` produces a clean, complete coverage report end-to-end (no crash, no unhandled rejections) as a repeatable check for future sessions.
4. Add new test coverage, in priority order:
   1. `backend/src/services/groupService.ts` — all `isMember`/`isCreator` authorization branches, plus core group CRUD logic (highest priority: security-relevant, zero coverage, 879 lines).
   2. `backend/src/controllers/groupController.ts`, `categoryController.ts`, `currencyController.ts` (currently 0%).
   3. `backend/src/middlewares/emailVerificationMiddleware.ts`, `errorHandler.ts`, `rateLimitMiddleware.ts` (currently 0%, security/error-handling relevant).
   4. Frontend screens, components, hooks, and context — currently untested beyond 3 service/util files. Specific files to be selected during planning based on risk and change frequency.

**Out of scope (deferred to a follow-on initiative):**
- Wiring the existing Playwright E2E suite into CI or verifying it currently passes.
- Validating or wiring the unverified Maestro mobile flows (`maestro.yaml`, `maestro-flows/`) or `mcp-database-server`.
- Reaching the roadmap's global 80% backend / 70% frontend coverage numbers — this initiative targets priority files, not an aggregate percentage.
- Fixing the separately-tracked roadmap bugs (web `/verify-email` route, settlement rent-expense calculation) unless a test written under this initiative happens to surface direct evidence about them.

### Key Decisions

- **Broad coverage push, not a narrow fix-only pass** (session-settled) — the initiative both restores the baseline and adds new priority coverage, rather than stopping at "green again."
- **Sequencing: fix first, then add coverage** (session-settled) — all existing failing/broken tests are fixed to a clean baseline before any new test-writing begins, so new tests are added against known-good scaffolding rather than alongside noise.
- **E2E/Maestro excluded, deferred to a follow-on brainstorm** (session-settled) — keeps this plan scoped to what `/ce-plan` can break down cleanly; Playwright CI wiring and Maestro validation are a distinct, larger workstream per the standard testing-pyramid ordering (unit/integration baseline before E2E automation).
- **Success measured by priority-file coverage, not a global percentage target** (session-settled) — avoids incentivizing low-value tests written just to move an aggregate number; the roadmap's 80%/70% figures are not the definition of done here.
- **`groupService.ts` is the top new-coverage priority** (session-settled) — it contains the authorization logic (`isMember`/`isCreator`) that the roadmap flags as "Critical — Blocks Production," and its correctness is currently unverified by any test.

### Success Criteria

- All backend Jest tests pass (0 failing, excluding intentional skips already present).
- All frontend Vitest tests pass (0 failing).
- `npm run test:coverage` completes without crashing in both `backend/` and `frontend/`, producing a readable coverage report.
- `groupService.ts` has meaningful coverage of its authorization branches (`isMember`/`isCreator` true/false combinations) plus happy-path and error-case coverage of its core CRUD functions, per this repo's testing standard (happy path + error cases + edge cases, not aggregate percentage).
- `groupController.ts`, `categoryController.ts`, `currencyController.ts`, `emailVerificationMiddleware.ts`, `errorHandler.ts`, `rateLimitMiddleware.ts` each move from 0% to meaningful coverage.
- At least a first pass of frontend component/screen/hook tests exists beyond the current 3 service/util files (specific files selected at planning time).

### Outstanding Questions

- Whether any of the 33 failing backend tests reveal an actual product bug (rather than a stale assertion) — each failure needs individual triage during implementation; if a service is found to be genuinely wrong, that's a bug fix, not a test fix, and should be raised separately rather than silently "fixed" by loosening the assertion.

---

## Planning Contract

**Product Contract preservation:** Product Contract unchanged from the `ce-brainstorm` version — the frontend priority list below resolves the one Outstanding Question that was explicitly deferred to planning; no other Product Contract content was altered.

### Research Findings

Local repo inspection (no external research needed — this is internal test-writing following established local conventions):

- **Backend service test pattern** (`backend/src/services/__tests__/expenseService.test.ts`): mocks Prisma via `jest.mock('../../lib/prisma')`, seeds `(prisma.<model>.<method> as jest.Mock).mockResolvedValue(...)` in `beforeEach`, then calls the real exported service function and asserts on its return value or thrown `AppError`. This is the pattern new `groupService.ts` tests must follow.
- **`groupService.ts` (`backend/src/services/groupService.ts`, 879 lines) exports 10 functions**: `createGroup`, `getUserGroups`, `getGroupById`, `addMemberByEmail`, `addMemberToGroup`, `removeMemberFromGroup`, `updateGroup`, `deactivateGroup`, `getGroupStats`, `getGroupExpenses`. `isMember`/`isCreator` authorization checks recur throughout (confirmed at lines 252, 328, 434, 785, 842 during brainstorm-phase inspection).
- **Frontend broken tests are not real tests today.** `frontend/src/services/__tests__/expenseService.test.ts` and `emailVerificationService.test.ts` mock the `axios` module directly (`vi.mock('axios')`) and call `axios.create().get(...)` inline in the test body — but the actual services (`frontend/src/services/expenseService.ts`, `emailVerificationService.ts`) import a shared `http` client from `frontend/src/api/http`, not raw `axios`. The tests never exercise the real service functions at all; `emailVerificationService.test.ts` additionally only asserts `typeof fn === 'function'`. Fixing these means rewriting them to `vi.mock('../../api/http')` and calling the actual exported functions (`verifyEmailToken`, `resendVerificationEmail`, `getExpenses`, `createExpense`, etc.), not patching the existing mock calls.
- **Frontend candidate files for first-pass new coverage** (`frontend/src/`): screens — `LoginScreen.tsx`, `VerifyEmailScreen.tsx`, `SettlementScreen.tsx`; context — `context/AuthContext.tsx`; components — `components/AddMemberModal.tsx`. Selected because: `AuthContext` and `LoginScreen` gate all authenticated access (highest blast radius if broken); `VerifyEmailScreen` and `SettlementScreen` correspond to bugs already flagged in `ROADMAP.md` (broken web verify link, missing rent expense in settlement) — tests here may surface direct evidence per the Outstanding Question above; `AddMemberModal` contains a destructive "Remove Member" `Alert.alert` confirmation the roadmap flags as a silent no-op on web.
- **No `CONCEPTS.md` or `STRATEGY.md` exists in this repo** — no canonical vocabulary or product-strategy constraints to reconcile against.

### Execution Direction

No test-first (TDD) direction was requested or implied — this work is retrofitting coverage onto existing, already-implemented behavior, so tests characterize current behavior rather than driving new behavior. Each unit below carries an `Execution note` reflecting that.

---

## Implementation Units

### U1. Fix failing backend Jest tests

**Goal:** Bring all 33 currently-failing backend tests to green by triaging each against current service behavior.

**Requirements:** Advances Success Criteria "All backend Jest tests pass."

**Dependencies:** None.

**Files:**
- `backend/src/__tests__/auth/login.test.ts`
- `backend/src/__tests__/auth/signup.test.ts`
- `backend/src/utils/__tests__/jwtHelper.test.ts`
- `backend/src/services/__tests__/expenseService.test.ts`
- `backend/src/controllers/__tests__/expenseController.test.ts`
- `backend/src/services/__tests__/authService.complete.test.ts`

**Approach:** For each failing assertion, read the current service/controller implementation first to determine whether the test is stale (update the assertion) or the implementation regressed (flag as a bug, do not silently loosen the test to pass). Known example: `authService.complete.test.ts` expects login-failure error code `ACCOUNT_INACTIVE`; current code returns `EMAIL_NOT_VERIFIED` — confirm this is an intentional behavior change before updating the assertion. Another known example in the same file: a `failedLoginAttempts` increment assertion on `prisma.user.update` is never called — trace whether the increment logic moved, was removed, or is genuinely broken.

**Execution note:** Characterization work — write down current, verified-correct behavior; do not change service behavior to satisfy old assertions without confirming the old assertion was actually the intended contract.

**Patterns to follow:** Existing passing tests in the same files for assertion style and Prisma mock setup.

**Test scenarios:**
- Test expectation: none — this unit repairs existing test assertions to match verified current behavior; it does not add new scenarios. Any assertion change must be justified by reading the corresponding service/controller code, not by matching the test to whatever the service currently returns.

**Verification:** `npm test` in `backend/` reports 0 failing suites, 0 failing tests (excluding pre-existing intentional skips).

---

### U2. Fix broken frontend Vitest tests and mock pattern

**Goal:** Rewrite `expenseService.test.ts` and `emailVerificationService.test.ts` to mock the actual `http` client the services use, and to exercise the real exported functions instead of asserting on mock scaffolding.

**Requirements:** Advances Success Criteria "All frontend Vitest tests pass" and "`npm run test:coverage` completes without crashing."

**Dependencies:** None.

**Files:**
- `frontend/src/services/__tests__/expenseService.test.ts`
- `frontend/src/services/__tests__/emailVerificationService.test.ts`
- `frontend/src/api/http/index.ts` (read-only reference for the client shape being mocked)

**Approach:** Replace `vi.mock('axios')` with `vi.mock('../../api/http')`, mocking the `http.get`/`http.post` methods the real services call. Call the actual imported service functions (`getExpenses`, `createExpense`, `verifyEmailToken`, `resendVerificationEmail`) and assert on their resolved/rejected values, not on the mock object directly.

**Execution note:** Characterization work against existing service implementations — no service code changes expected, only test rewrites.

**Patterns to follow:** `frontend/src/screens/EditExpenseScreen/utils/__tests__/splitValidation.test.ts` for this repo's Vitest conventions (the one frontend test file that already passes cleanly).

**Test scenarios:**
- Happy path: `getExpenses` resolves with data from a mocked `http.get`, including the `Accept-Language` header being passed through.
- Happy path: `createExpense` posts via mocked `http.post` and returns the created expense.
- Error path: `getExpenses` propagates a rejected promise when `http.get` rejects (network/API error).
- Happy path: `verifyEmailToken` resolves with the mocked verification response.
- Error path: `verifyEmailToken` propagates rejection on an invalid/expired token response.
- Happy path: `resendVerificationEmail` resolves with the mocked response.

**Verification:** `npx vitest --run` in `frontend/` reports 0 failing tests; `npx vitest --coverage --run` completes without unhandled rejections and writes a coverage report.

---

### U3. Confirm coverage tooling is stable

**Goal:** Verify `npm run test:coverage` runs cleanly end-to-end in both workspaces now that U1 and U2 are green, and document the working baseline numbers.

**Requirements:** Advances Success Criteria "`npm run test:coverage` completes without crashing in both `backend/` and `frontend/`."

**Dependencies:** U1, U2.

**Files:** None (verification-only unit; no source changes).

**Approach:** Run `npm run test:coverage` in `backend/` and `frontend/` after U1/U2 land. Confirm frontend coverage report generates (it currently crashes before writing output). No code changes anticipated unless the run surfaces a new tooling issue.

**Execution note:** Verification-only — smoke-check the tooling rather than writing new tests.

**Test scenarios:** Test expectation: none — this unit is a tooling verification, not new test coverage.

**Verification:** Both `backend/coverage/` and `frontend/coverage/` directories contain a generated report with no crash or unhandled-rejection output in the run log.

---

### U4. Add authorization and CRUD test coverage for `groupService.ts`

**Goal:** Cover all `isMember`/`isCreator` authorization branches and core CRUD behavior in `backend/src/services/groupService.ts`, the highest-risk zero-coverage file.

**Requirements:** Advances Success Criteria "`groupService.ts` has meaningful coverage of its authorization branches..." Directly tests the authorization logic the roadmap flags as "Critical — Blocks Production."

**Dependencies:** U1 (clean baseline before adding new tests).

**Files:**
- `backend/src/services/__tests__/groupService.test.ts` (new)
- `backend/src/services/groupService.ts` (reference; no changes expected unless a genuine authorization bug is found)

**Approach:** Mock `prisma` per the `expenseService.test.ts` pattern (U1's `Patterns to follow`). For every exported function, cover both the member/creator-authorized path and the non-member/non-creator rejected path (expect `AppError`).

**Test scenarios:**
- Happy path: `createGroup` creates a group with the requesting user as creator/member.
- Happy path: `getUserGroups` returns only groups the user belongs to.
- Happy path: `getGroupById` returns group data when the requesting user is a member.
- Error path: `getGroupById` throws `AppError` when the requesting user is neither a member nor the creator.
- Happy path: `addMemberByEmail` / `addMemberToGroup` succeed when called by the creator or an existing member.
- Error path: `addMemberByEmail` / `addMemberToGroup` throw `AppError` when called by a non-member.
- Happy path: `removeMemberFromGroup` succeeds when called by the creator.
- Error path: `removeMemberFromGroup` throws `AppError` when called by a non-creator member (if the current implementation restricts this to the creator — confirm from code first).
- Happy path: `updateGroup` succeeds for the creator/member; error path throws for a non-member.
- Happy path: `deactivateGroup` succeeds for the creator; error path throws for a non-creator.
- Happy path: `getGroupStats` and `getGroupExpenses` return data for a member; error path throws `AppError` for a non-member.
- Edge case: a user who is a member but not the creator — confirm which operations this role is and is not authorized for, per current code (do not assume; verify from the `isMember`/`isCreator` branch logic before asserting).

**Verification:** `groupService.test.ts` passes; coverage report shows `groupService.ts` moving from 0% to covering every `isMember`/`isCreator` branch and all 10 exported functions' happy and error paths.

---

### U5. Add coverage for zero-coverage backend controllers

**Goal:** Cover `groupController.ts`, `categoryController.ts`, `currencyController.ts` — currently 0%.

**Requirements:** Advances Success Criteria for these three files moving from 0% to meaningful coverage.

**Dependencies:** U1, U4 (controller tests typically mock the service layer that U4 now covers directly).

**Files:**
- `backend/src/controllers/__tests__/groupController.test.ts` (new)
- `backend/src/controllers/__tests__/categoryController.test.ts` (new)
- `backend/src/controllers/__tests__/currencyController.test.ts` (new)

**Approach:** Mock the corresponding service module (`groupService`, category/currency equivalents) and assert on HTTP response shape (status code, body) and Zod validation rejection for malformed input, following `backend/src/controllers/__tests__/expenseController.test.ts` and `authController.test.ts` as the closest existing patterns.

**Test scenarios:**
- Happy path: each controller endpoint returns the expected status/body when the service call succeeds.
- Error path: each endpoint returns the mapped error status when the service throws `AppError`.
- Edge case: Zod validation rejects malformed request bodies/params before the service is called (e.g. invalid `groupId`).

**Verification:** New controller test files pass; coverage report shows all three files moving from 0%.

---

### U6. Add coverage for security-relevant backend middleware

**Goal:** Cover `emailVerificationMiddleware.ts`, `errorHandler.ts`, `rateLimitMiddleware.ts` — currently 0%.

**Requirements:** Advances Success Criteria for these three files moving from 0% to meaningful coverage.

**Dependencies:** U1.

**Files:**
- `backend/src/middlewares/__tests__/emailVerificationMiddleware.test.ts` (new)
- `backend/src/middlewares/__tests__/errorHandler.test.ts` (new)
- `backend/src/middlewares/__tests__/rateLimitMiddleware.test.ts` (new)

**Approach:** Test each middleware as a unit against mocked Express `req`/`res`/`next`. For `errorHandler.ts`, confirm it fails closed (per this repo's OWASP A10 standard: no stack traces or internal error detail reaching the response in production mode) and returns the correct status/i18n error key for `AppError` vs. unexpected errors.

**Test scenarios:**
- Happy path: `emailVerificationMiddleware` calls `next()` for a verified user.
- Error path: `emailVerificationMiddleware` rejects with 403 (or repo's current status) for an unverified user.
- Happy path: `errorHandler` maps a thrown `AppError` to its declared status code and i18n key.
- Error path / security: `errorHandler` returns a generic message for an unhandled non-`AppError` exception and does not leak a stack trace when not in development mode.
- Happy path: `rateLimitMiddleware` allows requests under the configured threshold.
- Error path: `rateLimitMiddleware` rejects requests over the threshold with the correct status.

**Verification:** New middleware test files pass; coverage report shows all three files moving from 0%.

---

### U7. Add first-pass frontend coverage for priority screens/context/components

**Goal:** Add the first tests beyond the current 3 service/util files, covering `AuthContext`, `LoginScreen`, `VerifyEmailScreen`, `SettlementScreen`, and `AddMemberModal`.

**Requirements:** Advances Success Criteria "At least a first pass of frontend component/screen/hook tests exists beyond the current 3 service/util files."

**Dependencies:** U2 (working mock pattern for `http` client), U3 (working coverage tooling to measure against).

**Files:**
- `frontend/src/context/__tests__/AuthContext.test.tsx` (new)
- `frontend/src/screens/__tests__/LoginScreen.test.tsx` (new)
- `frontend/src/screens/__tests__/VerifyEmailScreen.test.tsx` (new)
- `frontend/src/screens/__tests__/SettlementScreen.test.tsx` (new)
- `frontend/src/components/__tests__/AddMemberModal.test.tsx` (new)

**Approach:** Use `@testing-library/react` (already a dependency) with the `vi.mock('../../api/http')` pattern established in U2. For `VerifyEmailScreen`, write the test to characterize *current* behavior — including reproducing the roadmap-flagged silent fallback-to-Login bug if it is confirmed present, rather than asserting the bug doesn't exist. Same approach for `SettlementScreen` regarding the rent-expense calculation bug: write a test against the current calculation logic and let it either pass (bug not reproducible at this layer) or fail with a clear assertion describing the discrepancy — do not adjust the test to hide a failure.

**Execution note:** Characterization tests — the goal is accurate coverage of current behavior, including latent bugs, not a green build at any cost. A failing test here that accurately demonstrates the roadmap's rent-expense or verify-email bug is a valid, valuable outcome; report it rather than adjusting the assertion to pass.

**Test scenarios:**
- `AuthContext`: happy path — login stores JWT and user state; logout clears it. Error path — invalid credentials leave state unauthenticated.
- `LoginScreen`: happy path — valid submit calls the auth service and navigates. Error path — invalid credentials show an error message; empty-field validation blocks submit.
- `VerifyEmailScreen`: happy path — valid token verifies and updates UI state. Edge case — behavior when the token param is present but verification is never confirmed against the backend (this is the suspected bug surface; characterize actual observed behavior).
- `SettlementScreen`: happy path — settlement summary reflects all expenses in a group, including rent-category expenses (this is the suspected bug surface; characterize actual observed behavior against a fixture with a rent expense included).
- `AddMemberModal`: happy path — submitting a valid member adds them. Edge case — the "Remove Member" destructive confirmation path, given the roadmap notes `Alert.alert` is a no-op on web (characterize current behavior; do not assume a working confirm dialog).

**Verification:** New test files pass or fail with assertions that clearly and accurately describe observed behavior (including any reproduced roadmap bugs); coverage report shows non-zero coverage for these five files.

---

## Verification Contract

- `cd backend && npx tsc --noEmit` passes.
- `cd backend && npm test` — 0 failing tests.
- `cd backend && npm run test:coverage` completes without error; `groupService.ts`, `groupController.ts`, `categoryController.ts`, `currencyController.ts`, `emailVerificationMiddleware.ts`, `errorHandler.ts`, `rateLimitMiddleware.ts` each show non-zero, meaningful coverage.
- `cd frontend && npx vitest --run` — 0 failing tests.
- `cd frontend && npx vitest --coverage --run` completes without unhandled rejections; `AuthContext.tsx`, `LoginScreen.tsx`, `VerifyEmailScreen.tsx`, `SettlementScreen.tsx`, `AddMemberModal.tsx` each show non-zero coverage.

## Definition of Done

- All Implementation Units U1–U7 complete and verified per their individual Verification fields.
- The Verification Contract above passes in full.
- Any backend test failure found in U1 to be a genuine product bug (not a stale assertion) is explicitly called out in the U1 completion notes rather than silently resolved.
- Any frontend test in U7 that reproduces a roadmap-flagged bug (verify-email, settlement rent calculation) is left failing with a clear, accurate assertion and called out rather than adjusted to pass.
