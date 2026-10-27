---
title: "Expense endpoints must scope every query to the caller's groups and answer 'not yours' with the same 404 as 'missing'"
date: 2026-10-25
category: security-issues
module: backend/src/services/expenseService.ts
problem_type: security_issue
component: service_object
symptoms:
  - "GET /api/expenses had no where clause, so any authenticated user received every user's expenses, including payer and participant names and emails (IDOR, CWE-639)"
  - "By-id routes answered 403 for a non-member and 404 for a missing id, so ids could be enumerated"
  - "The similar-expense and suggestion queries could surface another member's private category id"
root_cause: missing_permission
resolution_type: code_fix
severity: critical
tags: [idor, authorization, access-control, enumeration, prisma-where, category-privacy, security-review]
---

# Expense endpoints must scope every query to the caller's groups and answer 'not yours' with the same 404 as 'missing'

## Problem

Authentication was in place, but authorization was not: the route proved who you were and then read or changed any expense by id, or listed all of them (issue #153, PR #156). Related: private (per-user) custom categories could leak into suggestions.

## Symptoms

- `getAllExpenses()` took no user and ran `findMany` with no filter.
- By-id routes checked membership inline and returned a distinct 403, so a 403 proved the expense existed.
- `findSimilarExpenses` returned expenses whose category belonged to another user.

## What Didn't Work

- Nulling the private field afterwards. The first fix for the suggestion leak kept the row and returned `categoryId: null` when the category was another user's. The edit screen (`EditExpenseScreen.selectSuggestedMatch`) copies `categoryId` into the form unconditionally, so a null would have blanked the user's category. Filtering in the query itself removed the row, so no consumer sees a half-valid result.
- Validating the category on every update. An unconditional "is this category usable by the caller" check on update 404ed other group members whose expense already used someone else's private category. Only validate ids that are new or changed (see `revalidating-unchanged-per-user-theme-id-on-update-404s-other-group-members.md`).
- Returning 403 for non-members on by-id routes. It is accurate, but it tells an attacker which ids exist.

## Solution

Shared guards in `backend/src/services/groupGuards.ts`, used by every expense service path:

- Lists: `where: { group: accessibleGroupWhere(userId) }` (expenseService.ts:98), the same predicate as `groupService.getUserGroups` (groupGuards.ts:29).
- By-id (get, update, delete): `assertExpenseAccess(expense.group, userId, expenseId)` (expenseService.ts:366, 413, 470). It throws `expenseNotFound`, the one 404 also used for a truly missing expense (groupGuards.ts:53-65), so the two cases are byte-identical.
- Group-addressed routes (create, list by group): `assertGroupMember` (403), because the caller named the group.
- Suggestions: filter inside the Prisma `where` with `category: usableCategoryWhere(userId)` (expenseService.ts:731, 794; categoryService.ts:71), meaning global categories plus the caller's own.

Regression test: `backend/src/__tests__/regression/issue-153-expense-idor.test.ts` (also pins the exact shape of `accessibleGroupWhere(7)`). Merged to staging in PR #156; not yet released to master as of this writing.

## Why This Works

The database never returns rows the caller cannot see, so a missed check in a route cannot widen the result, and every by-id failure looks like "not found". Putting the privacy filter in the query means no later code path (a new field, a mapper) can forget to strip it.

## Prevention

- Every new expense read or write takes the caller's user id and goes through `accessibleGroupWhere` or `assertExpenseAccess`; a service function that takes no user id is a smell.
- Pick one status for "not yours" and "missing" on by-id routes (404). Use 403 only where the caller addressed the group.
- Scope inside the query, never by post-filtering or nulling fields.
- Category ids: create and update answer `404 CATEGORY_NOT_FOUND` for both a missing id and another user's private id (categoryService.ts:77; expenseService.ts:226-234 and 510-513), so the status and code do not reveal which. Only the message string differs ('Category not found' versus the i18n key `CATEGORY.NOT_FOUND`); check the rendered response body before treating this as closed.
- Still open when this was written: `/api/internal` routes are unauthenticated outside production (#155) and `POST /api/currencies` is unauthenticated (#157).

## Related Issues

- #153 (this), #151 (password hash leak): `prisma-include-true-on-user-relation-leaks-password-hash.md`.
- `route-file-missing-auth-middleware-goes-undetected-until-new-feature-needs-req-user.md`.
- `group-soft-delete-leaves-expense-titles-in-autocomplete-pool.md` (same `findSimilarExpenses` pool; check its code references against the current query).
