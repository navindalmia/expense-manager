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

## Continued — PR #55's e2e-mobile second failure re-diagnosed (resolved: Navin merged PR #55 himself)

Pulled annotations for the rerun: identical signature to the first failure (`"The action 'Build debug APK and run Maestro suite on an Android emulator' has timed out after 18 minutes."`), second consecutive occurrence — reinforces this is the documented unconditional upstream bug, not a regression. **While this was being investigated, Navin merged PR #55 himself directly on GitHub** (squash-merge, commit `bfe1cc9`, `merged_at: 2026-09-18T18:22:12Z`) — consistent with the solution doc's own explicit "don't gate merges on this job's badge" recommendation. No merge action was needed from this session.

- Attempted to delete the now-merged `feat/intelligence-layer-themes-labels-autocomplete` branch. Both the GitHub API and `git push --delete` were blocked by this sandbox's proxy (403, "Write access to this GitHub API path is not permitted through this proxy"). **Still needs manual deletion by Navin** — verified safe (PR API confirms `merged: true`; "not an ancestor" in `git merge-base` is expected for a squash merge, not a sign of lost work).
- **Master now has the full intelligence-layer feature**, including the `e2e/` Playwright harness and `.claude/hooks/pre-commit-quality-gate.js` — both previously only existed on the unmerged branch. This unblocked real E2E coverage for the rest of this session's fixes.

## Issue #44 — FIXED. PR: https://github.com/navindalmia/expense-manager/pull/60 (branch `fix/issue-44-update-group-response-unwrap`)

- Root cause: `groupService.ts`'s `updateGroup()` returned the raw `{ success, data, message }` response envelope instead of unwrapping it (unlike its sibling `addMemberByEmail` in the same file), so `HomeScreen.handleEditSuccess`'s list-replace check (`g.id === updatedGroup.id`) always compared against `undefined` and silently never matched — editing a group's name/description/currency required a manual pull-to-refresh to see the change.
- Red-before-green: **yes** — new `groupService.test.ts`, confirmed failing (result was the whole envelope) before the fix, passing after.
- E2E coverage: explicitly **not added yet** at commit time (`e2e/` didn't exist on `master` yet when this fix was written) — noted via an `E2E-Exempt:` trailer with the reasoning; PR #55 has since merged, so a follow-up Playwright case for this should be added.
- Real `/code-review` dispatched — found a real related bug: `getGroups()` and `deleteGroup()` in the same file have the identical envelope-unwrap bug, currently dead code (never called anywhere in the frontend). Filed as **issue #59** rather than fixed inline (not causally connected to #44's own correctness). Also added a missing error-path test the review flagged.
- `tsc --noEmit` clean, full frontend suite (125→ still green after review fixes) green.
- `docs/solutions/logic-errors/update-group-response-envelope-not-unwrapped.md` written (manual `ce-compound` — the CE plugin/skill isn't installed in this cloud session, only on the laptop per project memory; noted explicitly in the commit).

## Issues #50 + #51 — FIXED. PR: https://github.com/navindalmia/expense-manager/pull/61 (branch `fix/issue-50-51-currency-list-mismatch`)

Two independent bugs found, both real, both fixed in one PR (deliberate call — same shared root theme, genuinely one diff; noted here rather than silently bundling unrelated issues):

1. `CreateGroupScreen.tsx` hardcoded a `CURRENCIES` array (8 codes, including fake `CNY`, missing 5 real ones) instead of fetching `GET /api/currencies` like `EditGroupModal.tsx` already did.
2. **Found only by writing a real, live E2E test** (see below) — the backend's `createGroupSchema` had its *own* separate hardcoded currency `z.enum([...])` (9 values, also including fake `CNY`/`OTHER`, also missing the same 5 real currencies) applied only to `POST /groups`, not `PATCH /groups/:id`. This is why editing a group's currency to SEK already worked while creating one with SEK never could — the real functional half of #51, not just a cosmetic list difference.

**This session set up a genuinely live E2E stack from scratch** (Docker daemon wasn't available in this sandbox — used a local PostgreSQL 16 install instead, ran real migrations + seed, started the real backend and `npx expo start --web`, created a real test user via signup). `e2e/currency-list-mismatch.spec.ts` (new) was run iteratively against the partially-fixed code multiple times while debugging, actually reproducing the exact reported error text ("Selected currency is not available.") and then the second, deeper schema bug, before both fixes together made it pass cleanly — this is what surfaced bug 2 in the first place; a component-level or schema-level unit test alone would not have connected the two.

- Red-before-green: yes, at both the frontend unit level (`CreateGroupScreen.test.tsx`) and backend schema level (`groupSchema.test.ts`), plus the live E2E test's own red-then-green progression described above.
- Real `/code-review` dispatched — found the new frontend fetch code silently swallowed load failures (no user-facing error) and duplicated `EditGroupModal`'s existing fetch logic byte-for-byte. Both fixed in a follow-up commit: extracted a shared `useCurrencies()` hook (with its own tests) used by both screens now. Re-ran both the new E2E test and the pre-existing `e2e/intelligence-layer.spec.ts` afterward against the live stack to confirm no regression — both passed.
- `tsc --noEmit` clean on both sides. Full suites green: backend 417 tests, frontend 161 tests.
- `docs/solutions/logic-errors/three-independent-drifted-currency-lists.md` written (manual `ce-compound`).

## Local E2E environment note (for whoever resumes)

This cloud sandbox has PostgreSQL 16 installed locally (`service postgresql start`) but Docker's daemon cannot run (`no such file or directory` on the socket, `ulimit` operation not permitted) — `docker-compose` from the repo's normal dev setup will NOT work here; use direct `psql`/Prisma against local Postgres instead (`admin`/`admin123`/`expense_db`, matching `.env.example`). Also: `npx expo start --web` fails outright (fatal, not just slow) unless run with `EXPO_OFFLINE=1` — it otherwise tries to reach Expo's own API for a dependency-version check and this sandbox's network policy blocks that host, and the resulting non-JSON error response crashes the whole CLI rather than just skipping the check. Both `.env.local` (backend) and `frontend/.env.development.local` are gitignored and were created fresh this session — not committed, will not exist in a fresh checkout.

## Next steps

1. #47 (delete-group UI, per Navin's explicit answer: warn if the group has expenses, then soft-delete) — not yet implemented.
2. #45, #46 — not yet investigated; both need live/runtime reproduction (the now-working local E2E stack should be used for this) rather than static code reading alone, per earlier attempts finding nothing obviously wrong on read-through.
3. File GitHub issues for: (a) `deactivateGroup` throwing raw `Error` instead of `AppError` (found reviewing #47's area); (b) `signupSchema`'s no-backfill-for-existing-whitespace-names gap (from #49's review) — neither filed yet as of this entry.
4. Navin still needs to manually delete the merged `feat/intelligence-layer-themes-labels-autocomplete` branch (blocked from this sandbox by proxy policy).

## Issue #47 — FIXED. PR: https://github.com/navindalmia/expense-manager/pull/63 (branch `fix/issue-47-delete-group-ui`)

- Added a "Delete Group" button to `EditGroupModal`'s Danger Zone, exactly per Navin's answer: warns naming the expense count if the group has any, plain confirm if not, then soft-deletes (`DELETE /api/groups/:id`) and removes the group from `HomeScreen`'s list.
- Two real bugs found and fixed while wiring this dead code up for the first time (both causally connected to this feature's correctness): (a) backend `deactivateGroup` threw raw `Error` not `AppError` (fell through to a generic 500 instead of the correct 404/403 — still denied correctly, wrong status/message); (b) frontend `deleteGroup()` had the same envelope-unwrap bug as #44's `updateGroup()` (already logged as #59 while it was still dead code).
- Red-before-green: yes, at both backend (`deleteGroup.test.ts`, new) and frontend (`groupService.test.ts` `deleteGroup` tests) — both confirmed failing pre-fix, passing after.
- Real `/code-review` dispatched, found a genuine regression: the new `AppError` calls used literal English strings as `messageKey` (copying `updateGroup`'s existing bad pattern) instead of real i18n keys — worse for French users than the raw `Error` they replaced, since that at least fell through to a translated generic message. Fixed by adding `GROUP.NOT_FOUND`/`GROUP.DELETE_UNAUTHORIZED`/`GROUP.DELETE_FAILED` to both locale files. Also added a missing test for the untested `expenseCount === 1` singular-message branch.
- **P2/P3 finding logged as new issue rather than fixed inline:** #62 — the same file's catch-and-rewrap-as-AppError boilerplate is duplicated across most functions (pre-existing, unrelated to this PR's correctness).
- E2E coverage: `e2e/delete-group.spec.ts` (new), a real Playwright test against the live local stack — creates a group, deletes it via the real UI and a real browser confirm dialog, verifies it disappears. Re-ran `e2e/intelligence-layer.spec.ts` too — no regression.
- `tsc --noEmit` clean both sides. Full suites green: backend 416 tests, frontend 164 tests.
- Two `docs/solutions/` entries written (manual `ce-compound`): the i18n-key lesson, and the broader "wiring up dead code surfaces its latent bugs" lesson (also covers #59's still-unfixed sibling instance).

## Session status at this point

**Issues fully fixed and PR'd this session:** #49 (PR #57), #44 (PR #60), #50+#51 (PR #61), #47 (PR #63). **New issues filed along the way:** #59 (dead-code envelope bug in `getGroups`/`deleteGroup`... now partially addressed — `deleteGroup` itself was fixed as part of #47, `getGroups` is still open/dead), #62 (DRY boilerplate in `groupService.ts`). None of these 4 PRs merged by this session (per the "don't self-merge product PRs" rule) — all left open for Navin.

**Still open, not started:** #5, #48 (Navin said skip for now, live in this session), #45, #46 (need live/runtime investigation — the local E2E stack set up this session is available for this), plus the newly-filed #59 (partially), #62.

**Local E2E stack status:** the cloud sandbox this session was running in has since **reset** (confirmed: Postgres down, no backend/Expo processes, only the base environment-manager process alive) — the local stack described above no longer exists and must be fully re-set-up (Postgres start + migrate + seed, backend `npm run dev`, `EXPO_OFFLINE=1 npx expo start --web`, real signup for the test user) by whoever continues with #45/#46, following the "Local E2E environment note" above from scratch.

## Continued — pre-commit-quality-gate.js hook enhanced per Navin's direct request (PR #64)

Navin asked directly, after being told the session's PRs had full functional coverage but zero visual/screenshot regression coverage: "Can u put a hook somewhere appropriate before commit to do these things." Added to `.claude/hooks/pre-commit-quality-gate.js` (branch `chore/hook-visual-regression-and-feat-test-rules`, not tied to a numbered issue — a process/tooling change):

- **New Rule 3:** a commit touching `frontend/src/screens/**/*.tsx` or `frontend/src/components/**/*.tsx` must also touch a `maestro-flows/visual/*.yaml` baseline (this repo's existing `assertScreenshot` mechanism) or carry a `Visual-Regression-Exempt: <reason>` trailer. Deliberately exempt-trailer-based, not a hard block — verifying a baseline needs an Android emulator, unavailable in this same cloud sandbox, so a hard block would fail closed everywhere.
- **Rule 2 broadened** from `fix(`-only to `fix(`/`feat(` — new features now need a regression test, not just bug fixes.
- Manually verified all 3 rules' pass/block paths (matching the sibling hook's only prior precedent for verification) — then `/code-review` correctly flagged that as itself a gap (nothing this important should ship with only manual verification), so added `.claude/hooks/__tests__/pre-commit-quality-gate.test.js` (Node's built-in test runner, no new dependency, 8 cases) as a follow-up in the same PR.
- `/code-review` also caught CLAUDE.md and `PROJECT_MEMORY/05-QUALITY_STANDARDS.md` going stale relative to the new rules — fixed both in the same PR.
- One finding **not** code-fixed, documented instead: the exempt-trailer approach risks becoming a rubber-stamped habit rather than a genuine decision (same class of risk as the pre-existing `E2E-Exempt:`/`Test-Exempt:` trailers) — `docs/solutions/tooling-decisions/visual-regression-hook-uses-exempt-trailer-not-hard-block.md` written, framed as a known/accepted limitation, not a solved problem.
- PR: https://github.com/navindalmia/expense-manager/pull/64. Not merged by this session, per the standing rule.
