---
title: "Prisma include: true on a User relation returns the whole User row, password hash included, to every API caller"
date: 2026-10-25
category: security-issues
module: backend/src/services/expenseService.ts
problem_type: security_issue
component: service_object
symptoms:
  - "GET /api/expenses returned each expense's payer and split participants as full User rows: bcrypt password hash, failedLoginAttempts, lockedUntil and other internal columns"
  - "The leak was reachable by any authenticated user, and the response looked normal in the app because the UI only reads name and email"
  - "No test, type error or runtime error flagged it; it was found while reviewing a different change"
root_cause: wrong_api
resolution_type: code_fix
severity: critical
tags: [prisma, include, select, password-hash, data-exposure, api-response, regression-test]
---

# Prisma include: true on a User relation returns the whole User row, password hash included, to every API caller

## Problem

A Prisma `include: { paidBy: true, splitWith: true }` loads the related `User` rows with every column. Returned straight from a controller with `res.json`, that puts each user's bcrypt hash and lockout state in the API response. In this repo `getAllExpenses` did exactly that (issue #151).

## Symptoms

- Expense list responses carried `password`, `failedLoginAttempts` and `lockedUntil` inside `paidBy` and `splitWith`.
- The mobile app never showed it, since the screens only read `name` and `email`.
- Existing tests mocked Prisma and asserted the call shape `paidBy: true`, so they encoded the leak as expected behaviour.

## What Didn't Work

- Reading the app screens or the response in the UI. Nothing visible is wrong, so a manual test passes.
- Trusting the existing service test. The old `getAllExpenses` test asserted `include: { paidBy: true, ... }`; fixing the service made that stale assertion misleading. Two reviewers reported it as a failing test, but those assertions sit inside `describe.skip('createExpense', ...)` (`backend/src/services/__tests__/expenseService.test.ts:75`, with the `getAllExpenses` calls at lines 84 and 103), so they never ran. A validator caught that; check whether a test actually runs before calling it failing.
- A single-line regex as the only guard. The first regression test scanned for `relation: true` on one line; the adversarial review showed a reformatted or renamed relation, or `select: { password: true }`, slips past it. The scan is a tripwire, not proof.

## Solution

One shared select for every User relation, used instead of `true` or an ad-hoc field list:

```ts
// backend/src/lib/safeUserSelect.ts:9-13 (condensed)
export const SAFE_USER_SELECT = { id: true, name: true, email: true } as const satisfies Prisma.UserSelect;
```

It is applied to every user relation that reaches a response in `expenseService.ts` (for example lines 69, 73, 100 and 102) and `groupService.ts` (many call sites, such as lines 143-146). One more include in `emailVerificationService.ts` was narrowed in the same PR. A grep of non-test services, controllers and routes found no `<user relation>: true` left. Fixed in PR #152, merged to staging (not yet released to master as of this writing).

Regression test: `backend/src/__tests__/regression/issue-151-expenses-no-user-password-leak.test.ts` fails if `getAllExpenses` asks Prisma for the full row and scans services, controllers and routes for `<user relation>: true`.

## Why This Works

Prisma `include: { rel: true }` selects all scalar fields of the related model. `select: SAFE_USER_SELECT` names the only fields allowed out, so adding a sensitive column to the `User` model later cannot leak unless someone edits the constant itself.

## Prevention

- Never write `paidBy: true`, `members: true`, `user: true` or similar for the User model in code that reaches a response. Use `{ select: SAFE_USER_SELECT }`.
- Treat the `SAFE_USER_SELECT` constant as a security boundary: a change to it needs review for any new field.
- A regex scan is a backstop only. Prefer a runtime test that serializes a mocked `User` row containing a password and asserts it is absent from the response.
- When a review reports a stale test as failing, check it actually runs (`describe.skip`, jest config) before changing it.

## Related Issues

- Issues #151 (this leak) and #153 (the unscoped query next to it): see `expense-endpoints-must-scope-queries-to-callers-groups-and-return-same-404.md`.
- Earlier authorization gap in the same area: `route-file-missing-auth-middleware-goes-undetected-until-new-feature-needs-req-user.md`.
