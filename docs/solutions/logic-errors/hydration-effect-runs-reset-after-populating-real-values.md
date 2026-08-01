---
title: "Hydration effect called a state-resetting setter after populating real values, clobbering them"
date: 2026-08-01
category: docs/solutions/logic-errors
module: EditExpenseScreen / useSplitCalculator
problem_type: logic_error
component: frontend_stimulus
symptoms:
  - Opening an existing AMOUNT-type expense for editing showed every split member's amount as "0"/"0.00" instead of the actual saved value
  - The saved split data was correct in the database and correctly loaded into local state at one point during the render, then silently overwritten before the screen displayed
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [react, useeffect, ordering, hydration, state-reset, form-state]
---

# Hydration effect called a state-resetting setter after populating real values, clobbering them

## Problem

`EditExpenseScreen.tsx`'s expense-hydration `useEffect` populated a saved expense's split amounts with the real values (`updateAmount(memberId, expense.splitAmount[i])` for each member), then called `setSplitType(expense.splitType)` afterward. `setSplitTypeCallback` (in `useSplitCalculator.ts`) unconditionally recomputes a fresh default split whenever it's called with members already present — so calling it *after* hydration meant the real values were set correctly, then immediately overwritten with a freshly-computed (and, due to a separate timing issue, zero-based) default.

## Symptoms

- Real per-member amounts existed in the database and were correctly fetched.
- The hydration code that sets them (`updateAmount`) ran and correctly set local state — briefly.
- The very next call in the same effect (`setSplitType`) discarded that state and replaced it with a computed default, because `setSplitTypeCallback`'s "auto-populate defaults on type change" behavior doesn't distinguish "user is switching split type" from "we're hydrating a saved expense that already has this type."

## What Didn't Work

Nothing attempted — this was the original, unexamined call order. It wasn't obviously wrong from reading `EditExpenseScreen.tsx` alone; the bug only becomes visible by tracing what `setSplitTypeCallback` actually does internally (it's not a pure "set the type" setter, it also has side effects on other state).

## Solution

Reorder so any setter with recompute/reset side effects runs *before* the real values are applied, not after — the reset becomes a no-op (because there's nothing to reset yet) instead of a clobber:

```ts
useEffect(() => {
  if (expense) {
    prefillFromExpense(expense);
    if (expense.splitWith?.length > 0) {
      // setSplitType FIRST: while splitWithIds is still empty, its
      // auto-populate-defaults branch is a no-op (guarded by
      // `splitWithIds.length > 0`).
      setSplitType(expense.splitType);

      const uniqueMemberIds = [...new Set(expense.splitWith.map(u => u.id))];
      uniqueMemberIds.forEach(userId => addMember(userId));

      // Real saved values applied LAST - nothing after this point can
      // overwrite them.
      if (expense.splitType === 'AMOUNT') {
        expense.splitWith.forEach((user, idx) => updateAmount(user.id, expense.splitAmount[idx].toString()));
      }
      // ...same for PERCENTAGE
    }
  }
}, [expense]);
```

## Why This Works

`setSplitTypeCallback`'s side effect is gated on `prev.splitWithIds.length > 0`. Calling it before any members exist in state means that gate is false, so the reset branch never fires — the call becomes purely "record the type," with no side effect to clobber anything. The real values, applied after all state-populating calls, are the last write and therefore win.

## Prevention

- **When a setter has non-obvious side effects beyond its name (`setSplitType` also resets other state, not just the type), read its actual implementation before assuming call order doesn't matter in a hydration/initialization effect.** The bug wasn't visible from `EditExpenseScreen.tsx` in isolation.
- **In any hydration effect that both (a) calls a setter with a "reset to computed default" side effect and (b) populates real saved data, always call (a) before (b), or guard (a) so it can't fire once real data exists.** Order-dependent side effects are a recurring source of bugs; the general fix is either strict ordering (as done here) or making the reset explicitly conditional (e.g. only reset when the type is *actually changing* from what it already was, not on every call).
- **A residual risk noted but not fixed**: this fix assumes `splitWithIds` is genuinely empty when `setSplitType` runs first. If a different part of this hook's initialization (`groupMembers` loading before `expense`) ever pre-populates `splitWithIds` before this effect runs, the same clobbering bug could reappear via a different trigger. Not reproduced; flagged for whoever next touches this hydration path to check the load-order assumption explicitly, ideally with a test that controls the relative resolution order of the `expense` and `groupMembers` fetches.

## Related Issues

- Found and fixed in the same session as [equal-and-percentage-split-rounding-does-not-sum-to-total.md](./equal-and-percentage-split-rounding-does-not-sum-to-total.md) — same general area (`EditExpenseScreen`/`useSplitCalculator`), different bug class (state ordering vs. arithmetic).
