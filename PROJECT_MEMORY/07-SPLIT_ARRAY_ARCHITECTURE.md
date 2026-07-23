# Split Array Architecture — Reference

Current, durable convention for how expense splits are stored and loaded. Read before editing split-related code in `expenseService.ts`, `EditExpenseScreen.tsx`, or `useSplitCalculator.ts`.

## Array Storage Format

The payer is stored separately from the split arrays — split arrays contain **only** the other members, indexed positionally against `splitWithIds`.

**Backend (`expenseService.ts`):**
```typescript
expense.paidById = 3               // Payer, stored separately
expense.splitWithIds = [1, 2]      // Split members only — payer NOT included
expense.splitAmount = [25, 25]     // [member[0]_amt, member[1]_amt] — positional, matches splitWithIds
expense.splitPercentage = [50, 50] // [member[0]_%, member[1]_%]
```

**Frontend state (during edit):** mirrored as maps keyed by member ID rather than arrays:
```typescript
splitWithIds: [1, 2]
splitAmount: { 1: '25', 2: '25' }
splitPercentage: { 1: '50', 2: '50' }
paidById: 3 // separate from split maps, same as backend
```

**Loading (`EditExpenseScreen.tsx`):** map arrays back to state via **direct** positional indexing — no `+1` offset for the payer, since the payer isn't in the array:
```typescript
expense.splitWith.forEach((user, idx) => {
  updateAmount(user.id, expense.splitAmount[idx].toString());
});
```

## Initialization Order Guard

`useSplitCalculator`'s reinitialize effect normally resets `splitWithIds` to "all group members except payer" whenever `paidById` changes — correct for a brand-new expense, wrong for a saved one (it silently discards the user's actual saved split selection and recalculates evenly across everyone).

The guard: `useSplitCalculator` takes an optional `savedExpense` param; if `savedExpense?.splitWith?.length > 0`, the reinitialize effect skips resetting and lets the caller's `addMember()` calls populate the real saved members instead. `savedExpense?.splitWith?.length` is in the effect's dependency array so this stays correct if the saved data itself changes.

**When touching this code:** if you see split percentages/amounts revert to an even split across all members when reopening a saved expense, this guard is what's supposed to prevent it — check whether `savedExpense` is being passed through correctly before debugging further upstream.
