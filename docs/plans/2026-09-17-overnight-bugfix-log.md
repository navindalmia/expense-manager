# Overnight Bugfix Log — 2026-09-17

## PR #55 (feat/intelligence-layer-themes-labels-autocomplete)

- backend-test: pass
- frontend-test: pass
- e2e-web: pass
- e2e-mobile: still running as of this log entry (build + Maestro suite takes several minutes; a background poller was started to detect completion). NOT YET MERGED.
- Action needed on resume: run `gh pr checks 55`. If e2e-mobile is green, or fails with "3/3 Flows Passed" followed by a cleanup-step timeout (the documented `reactivecircus/android-emulator-runner` flake — see `docs/solutions/build-errors/e2e-mobile-ci-hang-and-cascading-fixes.md`), rerun the job and/or proceed to squash-merge + delete branch per the task instructions. Only investigate further if the actual Maestro flows fail.

## Issue #4 — Create/Edit Expense: split amounts don't update live (stale React.memo)

- Status: CLOSED, no code change needed.
- Verified against current `master`: `frontend/src/screens/EditExpenseScreen/components/SplitMembersInput.tsx` line 271 already includes `prevProps.totalAmount === nextProps.totalAmount` in the `React.memo` comparator. This was fixed by PR #8 ("fix: split-calc rounding, live-update, and settlement currency bugs"), which landed after issue #4 was filed.
- Closed issue #4 with an explanatory comment. No branch/PR created (nothing to change).

## Issues #5, #44–#51 — triage only, NOT YET IMPLEMENTED

Ran out of safe unattended runway in this session before starting implementation on these. Triage notes for whoever (human or next agent session) picks this up next:

### #5 — WhatsApp share invites by text only, no real join mechanism
**Open question for the repo owner (per task instructions, logging rather than guessing):** the issue itself proposes two very different directions — (a) build a real invite-link/join-by-code system (new backend token model + deep link + join screen), or (b) just relabel the button so it stops implying a working invite flow. These have very different scope/cost and (a) is a real product/architecture decision, not an implementation detail. Recommend `/ce-brainstorm` with the repo owner before starting.

### #44 — Currency sync issue in Expense Group edit ("does not update and needs a tap refresh")
Thin repro (one line). Plausible small bug (stale state not re-rendering after a currency change — same family as the #4 stale-memo bug), but needs a concrete repro path in the Edit Group screen before touching code responsibly. Next step: reproduce manually (Expo web or Maestro) against current master, then treat as a normal small bug fix once the exact stale-state cause is found.

### #45 — Paid-by field can't select 2nd+ payer in dropdown
Thin repro. Looks like a self-contained, well-specified UI bug (a dropdown/selector interaction bug), good candidate for straightforward small-scope fix + regression test next session — no product ambiguity here.

### #46 — Expense card not reflecting true share calculation ("Check Dinner card from exploratory testing")
Repro is a pointer to a specific manual-testing scenario ("Dinner" expense) with no further detail and no screenshot text captured. Cannot safely diagnose without reproducing the exact scenario (multiple members, custom split?) — needs either the repo owner's exact steps or a next-session investigation pass with `/ce-debug` to reconstruct the scenario from the codebase's split-calculation tests.

### #47 — "Do some work on deletion of group" / "Creator of group can delete the group"
**Open question for the repo owner:** ambiguous whether this is (a) a bug report that group deletion is currently broken/unsafe, or (b) a feature request to restrict deletion to the creator (implying non-creators can currently delete, which would be an authz bug), or (c) something else entirely. Title and body don't disambiguate. Needs the repo owner to clarify intent before implementation — logging rather than guessing on an authz-adjacent change.

### #48 — "No Account profile for user present" / "Give some feature to edit email or other profile update features"
This is a feature request (add a profile/account screen with editable fields), not a bug fix. Real scope ambiguity: which fields are editable (email likely needs re-verification flow per this repo's existing email-verification pattern), whether email change requires password confirmation, etc. Recommend `/ce-brainstorm` or at least a scoped `/ce-plan` with the repo owner before implementation — this is architecturally non-trivial (new screen, new backend endpoint(s), interacts with existing auth/email-verification flow) and not something to guess unattended.

### #49 — Accepts a full name starting with space (leading/trailing whitespace not trimmed/rejected)
Well-specified, small, no product ambiguity: validation gap. Good candidate for a fast, fully-scoped fix next session — likely a one-line `.trim()` / regex fix in the relevant Zod schema (backend) and/or a client-side check, plus tests for leading/trailing/all-whitespace names. No blocking question.

### #50 — "selected currency not available" error when saving a group for CNY
Repro is an image only (not fetched/read in this pass to conserve session budget). Needs the screenshot reviewed to see the exact error and which screen/flow it occurs on before diagnosing — likely a currency-list mismatch between two different currency sources (ties in with #44/#51's currency-sync theme). Good next-session candidate once the image is reviewed.

### #51 — Currency list view different between edit and create view of expense
No body text at all beyond the title. Same currency-sync theme as #44/#50 — plausible these three share one root cause (two different currency lists/sources feeding create vs. edit screens). Recommend investigating #44, #50, #51 together as one root-cause pass rather than three separate patches, since they may collapse into a single fix — but that's a judgment call for whoever resumes, not decided here.

## Summary / what's left

- PR #55: blocked only on e2e-mobile CI finishing (in progress). Not merged yet.
- Issue #4: closed, no code change needed.
- Issues #5, #47, #48: logged as needing repo-owner product/scope decisions before implementation — do not guess.
- Issues #44, #50, #51: likely one shared root cause (currency-list sync between screens) — recommend investigating together.
- Issues #45, #49: well-specified, no ambiguity, good candidates to implement first in the next session following the full CE workflow (branch, red-before-green test, tsc, real `/ce-code-review`, PR, no self-merge).
- Issue #46: needs a reproduced scenario before it can be diagnosed responsibly.

This session did not reach implementation on #5/#44–#51 due to running out of allotted session budget after PR #55 CI investigation and issue #4 triage. No unsafe or guessed changes were made. Resume here: check PR #55 CI status first, then pick up #45 or #49 as the next safe, unambiguous fix.
