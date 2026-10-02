# Issue #46 continuation — paused mid-fix, 2026-09-19

Paused explicitly at Navin's request ("make a note... will continue later,
don't want to exhaust tokens now") — this is a resume point, not a finished
writeup.

## What's done

**Root cause found and confirmed live** (real backend + Postgres, no mocks —
not just read through the code): a paying host who excludes themselves from
a `PERCENTAGE` split (e.g. pays for a guest, assigns the guest 100%, doesn't
include themselves in `splitWith`) has their own share miscalculated as the
**full expense amount** instead of `0`.

Concrete repro used (matches the issue's own "Check Dinner card" hint
almost exactly — an expense titled "Dinner", £100, host excluded, guest at
100%): `calculateUserExpenseShare`'s `PERCENTAGE` branch falls back to
`exp.splitPercentage[0]` — the *first splitWith member's* percentage (the
guest's), not the payer's — whenever the payer's own index isn't found.
Confirmed via a live `POST /api/groups` → `POST /api/expenses` →
`GET /api/groups` sequence: `userPersonalTotal` came back `100`, should be
`0`.

**Backend fixed**, branch `fix/issue-46-payer-excluded-percentage-share`,
commit `520893c`, **pushed but no PR opened yet** (deliberately — see below):
- `backend/src/services/groupService.ts`'s `calculateUserExpenseShare`: removed the wrong `splitPercentage[0]` fallback so it now falls through to the function's existing `return 0` default, matching the sibling `EQUAL` branch's already-correct opted-out behavior.
- Red-before-green regression test added to `backend/src/services/__tests__/groupService.test.ts` (confirmed failing — returned 100 — against pre-fix code, passing after).
- `tsc --noEmit` clean, full backend suite green (24 suites / 414 tests).

## What's NOT done yet — the actual next steps

This exact same buggy logic is **duplicated in two more places**, and the
backend fix above does **not** touch either of them:

1. `frontend/src/screens/ExpenseListScreen.tsx`'s `calculateUserShare` (a `useCallback` inside the component) — **this is the actual "expense card" the issue title refers to.** The backend fix only corrects the Group list's "your total" figure; the individual expense card's "Your share" text on `ExpenseListScreen` is still wrong today.
2. `frontend/src/screens/SettlementScreen.tsx`'s `calculateUserExpenseShare` (a module-level function) — same bug, and its own docstring incorrectly claims it's already "the single source of truth... used by ExpenseListScreen, SettlementScreen" (it isn't shared at all — three independent copies exist).

**Planned approach (decided, not yet executed):** extract ONE shared
frontend utility (e.g. `frontend/src/utils/calculateUserExpenseShare.ts`),
matching `SettlementScreen.tsx`'s existing pure-function signature style
(`(exp, userId) => number`, not a closure-based `useCallback`), fix the bug
there once, add real unit tests, then have both `ExpenseListScreen.tsx` and
`SettlementScreen.tsx` import and use it — deleting their local duplicate
definitions. This closes the "3 divergent copies" risk permanently rather
than patching each screen separately.

**Why no PR yet on the backend-only commit:** it's a genuine partial fix —
merging it alone would be safe (real bug, real fix, real tests) but
wouldn't actually resolve the user-visible issue #46 is about. Recommend
opening the PR only once the frontend half is done too, so the PR's `Fixes
#46` claim is actually true — or, if Navin wants the backend half merged
independently for its own sake, split intent should be an explicit decision
next session, not a default.

## Concrete next steps, in order

1. Extract the shared frontend utility as described above.
2. Fix the bug in it (same one-line-ish removal as the backend fix).
3. Delete the two now-redundant local copies in `ExpenseListScreen.tsx` and `SettlementScreen.tsx`, wire both to import the shared utility instead.
4. Add real unit tests for the utility (the payer-excluded PERCENTAGE case at minimum; consider porting the existing backend test's other cases too, since this frontend copy has never had dedicated tests — confirmed via `find frontend/src -iname "*ExpenseListScreen*test*"` returning nothing).
5. Add/extend real E2E coverage (Playwright) exercising the actual expense card's "Your share" text for this scenario, per this repo's standing "real E2E for UI changes" rule — `ExpenseListScreen.tsx` has zero existing E2E coverage today.
6. `tsc --noEmit` clean both sides, full suites green.
7. Real `/code-review` dispatched (not self-review) before commit.
8. Decide (ask Navin if unclear) whether to fold this into the existing backend-only commit's branch/PR or split frontend into its own — then open the PR(s), don't self-merge.
9. `ce-compound`: this is a good `docs/solutions/logic-errors/` candidate once done — "N duplicated copies of the same calculation function, same bug in the payer-excluded branch of each" is a reusable lesson (same shape as issue #62's DRY finding, and echoes the EQUAL-split "phantom +1" bug this exact function already had before, per the pre-existing regression test found while fixing this).

## Also still open from this session (unrelated to #46, listed for continuity)

- PR #65 (#59 getGroups fix), #66 (#62 DRY refactor), #67 (principles-audit CI job) — all open, CI status not yet re-checked as of this note.
- Visual-regression Maestro baselines for PRs #60/#61/#63 — flagged as a gap earlier this session, not yet started.
