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

## Continuation session, 2026-09-18 — resumed from mobile after a GitHub access handoff

This picked up as a genuinely interactive session (Navin present live on mobile, not unattended), after resolving a GitHub App/OAuth access mismatch on the cloud session (see chat transcript if needed — not repeated here, not project-relevant).

### PR #55 — e2e-mobile rerun

- Confirmed via GitHub API: `backend-test`, `frontend-test`, `e2e-web` all green on commit `05ce9da`.
- `e2e-mobile` failed with the exact documented signature from `docs/solutions/build-errors/e2e-mobile-ci-hang-and-cascading-fixes.md`: annotation `"The action 'Build debug APK and run Maestro suite on an Android emulator' has timed out after 18 minutes."` — matches the known unconditional upstream bug (reactivecircus/android-emulator-runner#385) exactly (same step name, same 18-minute value).
- **Caveat, stated explicitly per item 41's evidence-over-theory rule:** could not independently confirm "3/3 Flows Passed" in the raw log text itself — this cloud sandbox's network policy blocks Azure Blob Storage (`productionresultssa5.blob.core.windows.net`), which is where GitHub's log-download API redirects, and there was no workaround available (not attempted to bypass, per the environment's own instructions never to disable TLS/proxy). The signature match (exact step + exact timeout, no assertion-failure text) was judged strong enough evidence per the handoff's own stated criteria, but flagging the gap rather than claiming full log confirmation.
- Triggered a rerun via `POST /repos/.../actions/jobs/{id}/rerun`. Result: also FAILURE, with the identical annotation (same step, same 18-minute value) — second consecutive occurrence of the exact same signature, reinforcing (not just theorizing) that this is the documented unconditional flake rather than a real regression.
- **Resolution: Navin merged PR #55 himself directly on GitHub** (squash-merge, `merged_by: navindalmia`, `merged_at: 2026-09-18T18:22:12Z`, merge commit `bfe1cc9`) while this session was working on other issues — consistent with the solution doc's own explicit recommendation not to gate merges on this job's badge. No merge action was needed from this session.
- Attempted to delete the now-merged `feat/intelligence-layer-themes-labels-autocomplete` branch per the task's cleanup step; both the GitHub API (`DELETE /git/refs/heads/...`) and a `git push --delete` were blocked by this sandbox's proxy with 403 ("Write access to this GitHub API path is not permitted through this proxy"). **Branch still exists on the remote — needs manual deletion by Navin**, verified safe to delete (PR API confirms `merged: true`; the git-ancestor check shows "not an ancestor" only because it's a squash merge, which is expected and not a sign of lost work).
- **Master now has the full intelligence-layer feature**, including the `e2e/` Playwright harness and `.claude/hooks/pre-commit-quality-gate.js` — both previously only existed on the unmerged branch (confirmed via `git ls-tree` before/after). This unblocks proper E2E coverage for subsequent issue fixes in this session.

### Issue #4 — reconfirmed already closed, no action.

### Issues #5, #48 — asked Navin directly (he was live), both answered **skip for now**. Not implemented this session.

### Issue #47 — scope clarified by Navin: "If there are expenses added then first warn them that there are expenses and then only soft delete the group." Investigated current code: backend already has creator-only deletion (`deactivateGroup` in `groupService.ts:741`, throws raw `Error` not `AppError` — pre-existing minor issue, not fixed here, out of scope), but **no delete-group UI exists anywhere in the frontend at all** — the feature is backend-only and unreachable. Not yet implemented this session — queued next.

### Issue #49 — FIXED. PR: https://github.com/navindalmia/expense-manager/pull/57 (branch `fix/issue-49-trim-name-whitespace`)
- Root cause: `signupSchema`'s `name` field regex allowed whitespace at the edges; added `.trim()` before the length/regex checks (only write path for `name` in the codebase).
- Red-before-green: **yes**, explicitly confirmed — 2 new tests (name-with-whitespace stored trimmed; all-whitespace name rejected) both run and failed against pre-fix code first, then passed after the fix.
- E2E coverage: not applicable per the repo's own rule scope (backend validation-only fix, no new user-facing UI surface — the existing signup UI is unchanged).
- Real `/ce-code-review` dispatched (not self-review) — first attempt reviewed the wrong diff (the skill's forked execution runs against a different, stale local checkout than the one this session pushed to; matches the previously-documented `/code-review` PR-arg bug). Second attempt, after pushing the branch and pointing the skill explicitly at it, reviewed the correct diff and found: (a) two new tests reused test-numbers already taken by later pre-existing tests — fixed by renumbering to 18/19; (b) a stale "15 tests" header comment — fixed; (c) noted (not fixed, out of scope) that already-persisted names with whitespace aren't backfilled — no migration tooling exists in this repo for that, and it's pre-production.
- `tsc --noEmit` clean, full backend suite (346 tests) green.
- **P2/P3 findings logged as new issues:** none opened yet — the two review findings that weren't fixed inline (raw `Error` in `deactivateGroup`, no-backfill-for-existing-rows) are noted here rather than filed as separate GitHub issues; will file if this session runs out of budget before doing so directly.

### Issue #44 + #50 + #51 — ROOT CAUSE FOUND (confirmed, not guessed), single shared cause across all three:
- `frontend/src/screens/CreateGroupScreen.tsx:135` hardcodes `const CURRENCIES = ['GBP','USD','EUR','INR','AUD','CAD','JPY','CNY']` — a static list.
- `backend/prisma/seed.ts`'s `Currency` table seed has **no `CNY` row** (has GBP/USD/EUR/INR/AUD/CAD/JPY/SGD/HKD/CHF/NZD/SEK — 12 currencies, CNY not among them) — this is issue **#50** exactly: selecting CNY in Create Group and submitting hits `groupService.updateGroup`'s (and presumably `createGroup`'s) `currency` lookup, which 400s with `CURRENCY_NOT_FOUND` → surfaced to the user as "Selected currency is not available." Confirmed visually from the issue's own attached screenshot (fetched via GitHub API + WebFetch through the S3 redirect).
- `frontend/src/components/EditGroupModal.tsx` does NOT hardcode a list — it correctly calls `getCurrencies()` (`frontend/src/services/currencyService.ts`, `GET /api/currencies`) and renders the live backend list (12 currencies, no CNY). This is issue **#51** exactly: Create screen shows a different (wrong, hardcoded) 8-currency list than Edit's live 12-currency list.
- **Fix plan (not yet implemented this session):** make `CreateGroupScreen.tsx` call `getCurrencies()` the same way `EditGroupModal.tsx` already does, deleting the hardcoded `CURRENCIES` array. This single change closes #50 (CNY option disappears since it was never real) and #51 (both screens now share one source of truth) simultaneously. **Process note:** per the repo's "one issue per PR" rule, will open two PRs closing #50 and #51 respectively if the diffs can be meaningfully separated, but since it's genuinely one shared root cause and one shared diff, current plan is one PR with `Fixes #50, Fixes #51` in the body (documented here as a deliberate call, not a silent rule-break) unless Navin says otherwise.
- Issue #44 itself (title: "Currency sync issue in Expense Group edit... needs a tap refresh") is a **separate, second bug**, also root-caused: `frontend/src/services/groupService.ts:78-81`'s `updateGroup()` does `return response.data` where the backend's actual response envelope (confirmed in `backend/src/controllers/groupController.ts:218-222`) is `{ success, data, message }` — i.e. it never unwraps `.data.data`, unlike the sibling `addMemberByEmail` function 15 lines below it in the same file, which does unwrap correctly. Effect: `HomeScreen.handleEditSuccess(updatedGroup)` receives the envelope, not the real `Group`; its `g.id === updatedGroup.id` list-replace check compares against `undefined` and never matches, so the group list silently doesn't update after any group edit (name, description, or currency) until a manual pull-to-refresh re-fetches from the server. **Fix (not yet implemented):** change `updateGroup()` to `return response.data.data` (typed as `{ success: boolean; data: Group; message: string }` response, matching the pattern already used elsewhere in the same file).

### Not yet started this session: #45, #46 (both need live/runtime investigation, not just static code reading, to pin down — code inspection of the Paid-By picker and expense-card share-calc rendering didn't reveal an obvious bug on read-through).

## Next steps (for this session's continuation or a fresh one)

1. Re-check PR #55's e2e-mobile rerun result properly (it failed again — was not yet re-diagnosed at this log entry's time).
2. Implement and PR: #44 (updateGroup envelope-unwrap fix) and #50+#51 (currency-list unification) — both root-caused above, ready to implement.
3. Implement and PR: #47 (delete-group UI, creator-only, warn-if-has-expenses-then-soft-delete, per Navin's explicit answer above).
4. Investigate #45 and #46 with live testing (Playwright against a real running backend, per the repo's E2E standing rule) rather than static reading alone.
5. File GitHub issues for the two review-flagged-but-out-of-scope findings from #49's review if not already done: (a) `deactivateGroup` throws raw `Error` instead of `AppError`; (b) no backfill mechanism for already-persisted whitespace-padded names.
