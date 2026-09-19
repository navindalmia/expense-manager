---
title: "Group soft-delete (deactivateGroup) doesn't exclude its expenses from findSimilarExpenses's autocomplete pool"
date: 2026-09-14
category: logic-errors
module: backend/src/services/expenseService.ts, backend/src/services/groupService.ts
problem_type: logic_error
component: database
symptoms:
  - "A Playwright E2E test that creates a group+expense, 'deletes' the group via DELETE /api/groups/:id, then re-runs, gets a stale autocomplete match from the supposedly-deleted expense on the next run"
  - "GET /api/expenses/suggest?title=... returns a match whose source expense belongs to a group the user just called DELETE on"
root_cause: logic_error
resolution_type: test_fix
severity: low
tags: [soft-delete, isActive, autocomplete, findSimilarExpenses, test-cleanup]
---

# Group soft-delete (deactivateGroup) doesn't exclude its expenses from findSimilarExpenses's autocomplete pool

## Problem

While writing a real Playwright E2E test for the expense-title autocomplete feature (U5), the test's own cleanup step called `DELETE /api/groups/:id` between runs to keep each run idempotent. Despite that, re-running the test immediately hit a stale autocomplete match from the "deleted" group's expense, making the category-suggestion assertion flaky.

## Symptoms

- `GET /api/expenses/suggest?title=Taxi to the airport` returned a `matches` entry whose `expenseId` belonged to a group `DELETE /api/groups/:id` had already been called on in a prior test run.
- Confirmed live via direct `curl` against the real backend, not just an assumption from test output.

## What Didn't Work

- Assuming `DELETE /api/groups/:id` actually removes the group (and, via cascade, its expenses) from the database. It doesn't.

## Solution

`backend/src/controllers/groupController.ts`'s `deleteGroup` calls `groupService.deactivateGroup`, which sets `Group.isActive = false` — a soft delete, not a real deletion. `backend/src/services/expenseService.ts`'s `findSimilarExpenses` resolves the user's accessible groups with:

```ts
const accessibleGroups = await prisma.group.findMany({
  where: { OR: [{ createdById: userId }, { members: { some: { id: userId } } }] },
  select: { id: true },
});
```

This query has **no `isActive` filter** — a deactivated group's `id` is still returned as "accessible," so its expenses remain in `findSimilarExpenses`'s candidate pool indefinitely.

For the immediate E2E test-cleanup need, the fix was to **hard-delete the expense directly** instead of relying on the group soft-delete:

```ts
// e2e/intelligence-layer.spec.ts afterEach
await request.delete(`${API_BASE_URL}/expenses/${createdExpenseId}`, {
  headers: { Authorization: `Bearer ${data.token}` },
});
```

`expenseService.deleteExpense` does call `prisma.expense.delete(...)` — a real hard delete — so this reliably keeps re-runs idempotent.

## Why This Works

`DELETE /api/expenses/:id` removes the row entirely, unlike `DELETE /api/groups/:id`'s soft-delete-only behavior — so an expense removed this way can never resurface in any subsequent `findSimilarExpenses` query, regardless of the accessible-groups filter's `isActive` gap.

## Prevention

- **For any future E2E/integration test that needs deterministic cleanup of expense data**, delete expenses directly (`DELETE /api/expenses/:id`) rather than relying on a group-level soft-delete to remove them from search/matching pools.
- **Open product question, not resolved by this fix:** should a deactivated group's expenses still be findable by `findSimilarExpenses`/autocomplete? Today they are (by omission, not by design — no test or requirement currently asserts either behavior). If the intent is "deactivating a group should also stop suggesting its old expense titles," `findSimilarExpenses`'s `accessibleGroups` query needs an explicit `isActive: true` filter added. Flagged, not fixed — this is a product-behavior decision, not a clear bug, and out of scope for the E2E test-cleanup work that surfaced it.

## Related Issues

- `e2e/intelligence-layer.spec.ts` — the test this was found and fixed in.
- `backend/src/services/labelService.ts`'s `getLabelTotals` has a related, previously-flagged gap: its `visibleLabels` query also omits an `isActive` filter (found during U8/U9 code review, not yet fixed — same root-cause class as this doc).
