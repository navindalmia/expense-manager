---
title: "Naive per-member split rounding doesn't sum back to the total"
date: 2026-08-01
category: docs/solutions/logic-errors
module: expenseService / useSplitCalculator / splitValidation
problem_type: logic_error
component: service_object
symptoms:
  - "Split percentages must add up to 100%" error when splitting an expense among a member count where 100/N doesn't terminate at 2 decimals (e.g. 3, 6, 7, 9 members)
  - EQUAL and PERCENTAGE split totals silently summed to a cent (or more) off the actual expense amount, both in the DB and in the displayed UI preview
  - The displayed per-member amount sometimes didn't match what was actually submitted/persisted for the same member
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [split-calculation, rounding, floating-point, largest-remainder-method, expense-splitting, money]
---

# Naive per-member split rounding doesn't sum back to the total

## Problem

Both the frontend (`useSplitCalculator.ts`, `SplitMembersInput.tsx`) and backend (`expenseService.ts`) computed each split member's share independently — `(total / N).toFixed(2)` repeated N times for EQUAL, or `(pct / 100 * total).toFixed(2)` per member for PERCENTAGE. Independent rounding does not guarantee the shares sum back to the original total. This broke a strict "sum must equal target" server-side validation and, separately, silently persisted expense records whose split amounts didn't add up to the recorded expense amount.

## Symptoms

- Creating/editing an expense split 3 ways (or any non-dividing member count) failed with `"Split percentages must add up to 100%"` even though the UI showed 3× 33.33%.
- `100 / 3 = 33.33` repeated 3 times sums to `99.99`, not `100.00` — a real off-by-one-cent gap, not a display rounding artifact.
- For EQUAL-type expenses specifically, there was **no server-side validation at all** (unlike AMOUNT/PERCENTAGE), so this class of bug shipped silently to the database with no error ever surfacing.
- Fixing only the *submitted* value calculation left the UI preview showing a different (still-naive) number than what got persisted — "what you see is not what you pay."

## What Didn't Work

- Nothing was attempted before this fix — the naive per-member rounding was the original, unexamined implementation on both frontend and backend.

## Solution

Replaced independent per-member rounding with an integer-cents distribution that guarantees the shares always sum exactly to the target, using two algorithms depending on whether shares should be equal or proportional:

**Equal shares** — floor-divide in integer cents, give the leftover cent(s) to the first N shares in order:

```ts
function distributeCentsEvenly(totalCents: number, n: number): number[] {
  const baseCents = Math.floor(totalCents / n);
  const remainderCents = totalCents - baseCents * n;
  return Array.from({ length: n }, (_, i) =>
    (baseCents + (i < remainderCents ? 1 : 0)) / 100
  );
}
```

**Proportional shares** (PERCENTAGE splits) — the largest-remainder method: compute each share's raw proportional cents, floor them, then give the leftover cent(s) to the shares with the largest fractional remainder (not just index order, since shares aren't equal):

```ts
function distributeAmountByWeights(amount: number, weights: number[]): number[] {
  const totalCents = Math.round(amount * 100);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const rawShares = weights.map(w => (w / weightSum) * totalCents);
  const flooredCents = rawShares.map(Math.floor);
  let remainderCents = totalCents - flooredCents.reduce((a, b) => a + b, 0);
  const order = rawShares
    .map((share, i) => ({ i, fraction: share - flooredCents[i] }))
    .sort((a, b) => b.fraction - a.fraction);
  const result = [...flooredCents];
  for (const { i } of order) {
    if (remainderCents <= 0) break;
    result[i] += 1;
    remainderCents -= 1;
  }
  return result.map(c => c / 100);
}
```

Both were implemented **identically on frontend and backend** (`frontend/src/screens/EditExpenseScreen/utils/splitValidation.ts` and `backend/src/utils/splitCalculation.ts`) so the live preview a user sees always matches what gets submitted and persisted — not just fixing one side.

## Why This Works

Rounding each share independently loses information: `Math.round`/`.toFixed(2)` on each of N values throws away sub-cent precision N times, and those N roundings don't compose back to a rounding of the original total. Working entirely in integer cents and only ever rounding *once* (at the point of distributing the remainder) preserves the invariant `sum(shares) === round(total * 100) / 100` by construction, regardless of N or the weight distribution.

## Prevention

- **Any time a total is divided among N recipients (equal or proportional), use an integer-cents largest-remainder distributor — never map-and-round each share independently.** This is a general pattern, not specific to this app.
- **Validate that computed shares actually sum to the target, not just that N is handled.** The original bug's most dangerous manifestation (EQUAL splits) had zero validation catching the drift — a sum-check test would have caught it immediately: `expect(shares.reduce((a,b)=>a+b,0)).toBeCloseTo(total, 2)`.
- **When a value is computed once and both displayed and submitted, compute it in exactly one place (or two provably-identical places) — never let the display use a different formula than what's persisted.** A display/submission mismatch is a distinct bug class from the rounding bug itself and was found separately by adversarial review after the first (server-only) fix shipped.
- **Sum-only validation (`abs(sum - target) < epsilon`) does not imply individual values are valid.** `[150, -50]` sums to exactly 100 but is financially nonsensical — a sum check must be paired with a per-value non-negative (or in this app's case, strictly-positive) check.

## Related Issues

- GitHub issue #4 (split amounts not updating live) was the original trigger for this investigation; the rounding bug was found while fixing it, not the original report.
