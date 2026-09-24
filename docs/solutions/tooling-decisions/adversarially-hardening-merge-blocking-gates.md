---
title: "Building the regression pack: CI-only test execution, and why a merge-blocking gate needs two adversarial review rounds"
date: 2026-09-22
last_updated: 2026-09-24
category: tooling-decisions
module: regression-pack-gate
problem_type: tooling_decision
component: development_workflow
severity: high
applies_when:
  - "building or modifying any merge-blocking mechanism (pre-commit hook, required CI check, lint gate)"
  - "a gate's job is to decide whether a commit/PR is allowed to land"
  - "the gate inspects staged/committed content rather than the working tree"
  - "the gate uses pattern-matching or regex to detect 'a real test was added'"
  - "tempted to stop after one adversarial-review pass because early bypasses were fixed"
  - "adding tests against an existing utility function without confirming the test's mock data actually exercises the code path under test"
  - "a merge-blocking gate has already passed two adversarial code-review rounds and is now running in real production CI usage (not just reviewed code)"
  - "a gate's commit/tip-exemption check reads commits[0] of a GitHub Actions event payload, and the workflow trigger is pull_request (checks out a synthetic merge commit as HEAD, not the PR branch tip)"
  - "a repeatedly-synced/rebased branch's merge history is being scanned for 'already fixed' commits, where squash-merged PRs can reappear as phantom pre-squash commits"
  - "a test file predates or falls outside the gate's own directory/naming convention"
  - "writing a multi-trailer commit message that must include both an exemption trailer (e.g. Regression-Exempt) and Co-Authored-By — these must land in the same final trailer paragraph or the exemption is not recognized"
related_components: ["testing_framework", "tooling"]
tags: [regression-pack, pre-commit-hooks, ci-gating, adversarial-review, bypass-resistance, red-before-green, test-quality, git-hooks, production-ci-usage, third-adversarial-round, synthetic-merge-commit, pull-request-event-head, squash-merge-phantom-commits, tip-exempt-check, trailer-paragraph-ordering, recurring-mistake]
---

# Building the regression pack: CI-only test execution, and why a merge-blocking gate needs two adversarial review rounds

## Context

Building a "regression pack" for this repo (PR #74, branch `chore/regression-pack-gate`, **merged 2026-09-23**) — one test per fixed bug, wired so a regression can never land silently again — surfaced two lessons worth keeping independent of this specific repo: where test *execution* should live relative to git hooks, and how many adversarial-review rounds a merge-blocking gate actually needs before it can be trusted.

**All paths cited in this doc exist on `master` as of 2026-09-24** (originally written against the still-open `chore/regression-pack-gate` branch; PR #74 has since merged, so every path below is current).

The pack itself lives at `backend/src/__tests__/regression/`, `frontend/src/__tests__/regression/`, `e2e/regression/`, one `issue-<N>-<slug>.test.ts` per fixed bug. It's gated by `.githooks/pre-commit`, `.githooks/commit-msg`, `scripts/regression-gate.js`, `scripts/install-hooks.js`, and CI jobs `regression-gate` / `e2e-regression` in `.github/workflows/ci.yml`.

A third round of findings came from actually *using* the merged gate in production CI to land 9 real PRs on 2026-09-23/24, rather than from adversarial review of the gate's own code. Two of the three were false positives caused by branch/repo state the gate's authors hadn't anticipated (a convention race between concurrent PRs, and stale commit history from `git merge`-based branch syncing); the third was a genuine bug in `evaluatePr()` itself, in `scripts/regression-gate.js` on `master`, fixed in PR #81. All three are described below under Guidance (C).

## Guidance

**(A) Local git hooks should do static checks only; only CI should execute test suites.**

The first version of `.githooks/pre-commit` ran the full backend jest + frontend vitest regression suites on every `git commit`, against the git-staged index (exported via `git checkout-index`, not the working tree, so an unstaged fix couldn't mask a broken staged file). The repo owner explicitly rejected this: he did not want his laptop's or the AI assistant's local compute spent running a test suite on every single commit.

The rework, as it stands on `chore/regression-pack-gate`:

- `.githooks/pre-commit` (real file, in full):
  ```sh
  #!/bin/sh
  # STATIC checks only (no npm, no jest/vitest, no node_modules): banned .skip/.todo/.only and
  # undiscoverable files in regression dirs. The suites themselves run in GitHub CI.
  ROOT="$(git rev-parse --show-toplevel)" || exit 1
  exec node "$ROOT/scripts/regression-gate.js" static
  ```
- `.githooks/commit-msg` (real file, in full):
  ```sh
  #!/bin/sh
  # STATIC only: fix commits must ADD a new qualifying regression test (or carry Regression-Exempt:).
  ROOT="$(git rev-parse --show-toplevel)" || exit 1
  exec node "$ROOT/scripts/regression-gate.js" msg "$1"
  ```
- Both delegate to `scripts/regression-gate.js`, which is explicit in its own header comment about the split:
  ```js
  // Regression-pack gate. WHERE THINGS RUN:
  //   * The regression suites (jest/vitest) run ONLY in GitHub CI (`suites` mode, `regression-gate` job) - never on
  //     the developer's machine at commit time. Local hooks are STATIC only: no node_modules, no npm, no test runner.
  ```
  `static` mode (`scanIndex()` in the script) reads staged file contents via `git ls-files --cached -z` + `git show :<path>` — git plumbing, never `fs.readFile` against the working tree — and rejects files that: aren't a `*.test|spec.<ext>` the target workspace's runner would even discover, or contain a banned modifier (`BANNED_RE` matches `.skip`/`.todo`/`.only`/`.fails`/`.fixme`/`xit`/`fit`/etc.). `msg` mode (`evaluateCommit()`) additionally requires that a `fix(...)`-shaped commit's *staged diff* adds a new file under a regression dir matching `issue-<N>-*.test.ts` that has at least one real test call (`TEST_CALL_RE`) and one assertion (`ASSERT_RE`) — or carries a `Regression-Exempt: <reason>` trailer.
- Actual execution moved entirely into CI: the `regression-gate` job (`.github/workflows/ci.yml`) runs the gate script's own unit tests, the static scan, the backend jest + frontend vitest regression suites (mocked, no real DB), and a PR/push-range check (`regression-gate.js pr`) — this is explicitly the backstop for `git commit --no-verify`, per the script's own comment (`// closes --no-verify`). A separate, slower `e2e-regression` job runs real Playwright against a genuinely live Postgres + backend + Expo web, seeded fresh each run, and (per the CI step list) has a "Verify e2e tests actually executed" step so a Playwright JSON report with 0 executed specs doesn't silently pass.
- `scripts/install-hooks.js` wires `core.hooksPath=.githooks` via a `prepare` npm script on `npm install` (documented in the PR body as skipping if a different `hooksPath` is already set, or in CI).

The result: nothing test-runner-shaped happens on the developer's machine at commit time — sub-second regex/plumbing checks only — while the actual regression suites still run, just server-side in CI, which is also where the harder-to-bypass enforcement (branch protection, PR-range checks) lives anyway.

**(B) A merge-blocking/gating mechanism needs at least two full adversarial-review rounds before it can be trusted — plan for it, don't treat round 1 as sufficient.**

Round 1 of `/ce-code-review`'s adversarial persona on the first version of this gate found 5 real P1 bypasses:
1. The hooks were purely opt-in — nothing forced installation, and CI didn't run the pack either, so `git commit --no-verify` or simply never installing the hooks bypassed everything.
2. Literally any staged file under the regression-test directory satisfied "a fix commit added a regression test" — an empty file, a whitespace-only edit, a copy of an unrelated file.
3. `--passWithNoTests` combined with a wrong/unrecognized file extension meant a "test" file the runner couldn't even discover would still exit 0 — a silent pass with zero tests actually run.
4. A `.skip()`'d or `.todo` test counted as a passing test.
5. The suites ran against the unstaged working tree, not the actual staged/committed index — so a broken staged file could pass if an unrelated "fixed" version happened to sit unstaged in the working tree.

All 5 were fixed (this is what produced the `static`/`msg`/staged-index design described in (A), plus `hasRealTest()`'s combined test+assertion+banned-modifier check and CI's own regression-gate job closing the `--no-verify` and opt-in-install gaps).

Round 2 was run anyway, on the assumption that round 1 had *not* necessarily made the mechanism solid — and it found a different class of hole round 1's fixes didn't anticipate:
- A test with zero real assertions (`it('some behavior', () => {})`) is syntactically a valid test call but semantically vacuous, and still satisfied "added a real test" — this is why `hasRealTest()` in the shipped script requires `countAssertions(src) >= 1` as a *separate* condition from `countTests(src) >= 1`, not just presence of an `it(`/`test(` call.
- The regex-based detector for "does this file contain a real test invocation" was fooled by an unrelated `someRegex.test(x)` method call being misparsed as a legitimate `test(...)` call — reflected in the shipped `TEST_CALL_RE`'s negative lookbehind `(?<![.\w$])` guarding against a preceding `.` (a method-call context), which a naive `/\b(?:it|test)\s*\(/` would miss.

A later round (`scripts/__tests__/regression-gate-r3.test.js`, present on the branch) continued the same pattern — the CI log for that commit references scanning `e2e/regression`, banning `test.fixme`/`test.fail` and conditional `.skip()`/`.fixme()` calls, and least-privilege CI permissions — evidence that the "one more adversarial pass finds a new class of hole" pattern held past round 2 as well, not just twice.

Separately, but illustrating the identical principle at the level of a single test rather than the gate mechanism: the first regression test ever seeded into the pack, for issue #46 (payer excluded from a PERCENTAGE split), was itself found to be vacuous. An earlier draft's mock payload used a flat `paidById: 1` field, but the utility under test (`calculateUserExpenseShare` in `frontend/src/utils/calculateUserExpenseShare.ts`) reads `exp.paidBy?.id` — a nested object, not a flat id — so the branch the test was supposedly protecting was never exercised; the assertion passed identically whether the #46 bug was present or already fixed. The shipped, corrected version (`frontend/src/__tests__/regression/issue-46-payer-excluded-percentage-share.test.ts`) uses a nested `paidBy: { id: 1, name: 'Host', email: 'host@test.com' }` fixture instead. This was not caught by reading the test and reasoning about it — it was caught by literally reverting the #46 fix in a scratch copy and confirming the "protecting" test still (wrongly) reported green.

**(C) Production usage of a merge-blocking gate finds a third class of hole: real branch/repo topology the gate's own tests never modeled — plus one genuine bug in the gate script.**

Rounds 1 and 2 (documented in (B) above) were adversarial code review of the gate's logic. Round 3 came from actually merging 9 real PRs through the finished gate and hitting failures no review round had reason to anticipate, because they depend on real git/GitHub state, not just the gate's source:

1. **Test-file-location mismatch across concurrent PRs.** PR #72 (fixing issue #50) had its regression test written before PR #74 (`chore: cumulative regression pack with pre-commit + CI gate`) — developed concurrently — finalized and merged the `backend|frontend/src/__tests__/regression/issue-<N>-<slug>.test.ts` path convention that `isQualifyingPath()` in `scripts/regression-gate.js` enforces via its regex:
   ```js
   function isQualifyingPath(file) {
     return !!/^(backend|frontend)\/src\/__tests__\/regression\/(?:.*\/)?issue-\d+-[^/]+\.(?:test|spec)\.(\w+)$/.exec(file);
   }
   ```
   When #72 tried to merge after #74 landed, its test's real location no longer matched the now-enforced convention — `regression-gate` correctly failed it (this is the gate doing its job, not a bug). Fixed by moving the test file to the correct path, fixing its relative imports, re-verifying with `npx tsc --noEmit` + the test itself, and re-pushing. **Lesson: when a gate's path/naming convention is still being finalized on one branch while other branches are independently adding files it will apply to, expect a location mismatch at merge time — it's not a gate bug, it's exactly what the gate is for, but it means "test added before the convention froze" needs a location re-check before merge, not just a content re-check.**

2. **Squash-merge phantom commits from `git merge`-based branch syncing.** After several PRs were squash-merged into `master`, a different long-lived branch (PR #78) that had been repeatedly re-synced with `master` via `git merge` (not rebase) still carried the OLD pre-squash commit objects inside its own merge history. `git log origin/master..branch` (the same range `evaluatePr()` is built from — see `scripts/regression-gate.js`'s `rev-list base..HEAD` call) showed those already-landed PRs' original commits as if they were still unique to the branch — each a `fix(...)`-shaped commit that `evaluatePr()`'s `unexemptedFix` check (`commits.some((c) => isFixCommit(c.message) && !hasExemption(c.message))`) correctly flagged as needing its own qualifying regression test, even though their real content was already safely on `master`. Fixed by cherry-picking the branch's one real commit fresh onto current `master` instead of merging — producing a branch exactly 1 commit ahead of `master`, no phantom history, sidestepping the issue entirely rather than working around it. **Lesson: a per-commit-range gate (`evaluatePr`'s `commits` array, built from `git rev-list base..HEAD`) is only as clean as the branch's merge strategy — `git merge`-based syncing leaves already-merged commits visible in the range indefinitely; prefer rebase or cherry-pick onto a long-lived branch that will be evaluated this way.**

3. **Synthetic `pull_request` merge-commit tip-exemption gap — a genuine bug in the gate, fixed in PR #81.** GitHub Actions checks out a synthetic merge commit as `HEAD` for `pull_request`-triggered runs, not the PR branch's real tip directly — documented GitHub Actions behavior, not a GitHub bug. Before PR #81, `evaluatePr()`'s tip-exemption check read only `commits[0]`, assuming index 0 was always the PR's real (possibly exempted) tip. For a `pull_request` run, `commits[0]` is that auto-generated synthetic merge commit instead, whose message never carries a real `Regression-Exempt:` trailer since GitHub generates it, not the PR author — producing a false BLOCKED result on a legitimately exempted PR (#78, on its second merge attempt). Confirmed not a flake by reproducing deliberately: running `node scripts/regression-gate.js pr origin/master` locally against the raw branch (no synthetic merge commit, since there's no real `pull_request` event outside Actions) passed cleanly every time — which is what initially made it look like a flake/false-negative until the real CI job log was pulled and the failure mechanism traced through to `commits[0]`. Fixed in `evaluatePr()` (`scripts/regression-gate.js`, current `master`): the `tipExempt` check now scans every commit in the range, not just index 0:
   ```js
   // Checking ANY commit (not just commits[0]) matters because a `pull_request`-triggered CI run
   // checks out GitHub's synthetic merge commit as HEAD, not the PR branch tip directly -- so
   // commits[0] from `rev-list base..HEAD` is often that auto-generated, trailer-less merge
   // commit, not the PR's real (possibly exempted) commit. A synthetic merge commit's own message
   // never carries a real trailer, so this can only find a genuine exemption, never a false one.
   const tipExempt = commits.some((c) => hasExemption(c.message));
   const metaFix = (branchSignal || titleSignal) && !tipExempt;
   ```
   Because a synthetic merge commit's message can never itself carry `Regression-Exempt:`, widening from `commits[0]` to `commits.some(...)` can only ever *find* a genuine exemption that was missed — it cannot introduce a new bypass. Shipped in PR #81 with a new test in `scripts/__tests__/regression-gate-r2.test.js` (`'PR mode: tip exemption is found anywhere in the range, not just commits[0] ...'`) reproducing the exact shape: a trailer-less "Merge ... into ..." commit at index 0, the real exempted commit behind it. Confirmed red-before-green for real: stashed the fix, reran the suite, the new test failed exactly as expected; restored the fix, all tests passed. **Lesson: any gate that reads "the tip commit" of a range assumes a 1:1 mapping between "index 0 of `rev-list`" and "the thing a human authored" — CI checkout mechanics (synthetic merge commits for `pull_request` triggers being the concrete case here) can silently break that assumption; scan the whole range for a signal like an exemption trailer rather than trusting position 0, when doing so cannot introduce a bypass.**

**Connected finding: the same `Regression-Exempt:` trailer-placement gotcha this doc already documents was violated twice more this session — caught only by CI, not by re-reading this doc.**

Guidance (B)'s round-2 findings already established that `parseTrailers()` only reads the *last paragraph* of a commit message (see `scripts/regression-gate.js`: `hasExemption('fix: x\nRegression-Exempt: sneaky in subject block')` is `false`, and a `Regression-Exempt:` line separated from `Co-Authored-By:` by a blank line into its own paragraph is also `false` — only a trailer sharing the final paragraph with `Co-Authored-By:` counts). While hand-authoring commit messages for fixes #1 and #2 above, this exact rule was violated twice more this session — each time only caught by a real CI failure and pulling the log, not by re-reading the documented rule and eyeballing the message. What actually resolved it both times was not "remembering the rule" but running the gate's own real parser against the literal candidate message before pushing:
```sh
node -e "const g = require('./scripts/regression-gate.js'); console.log(g.hasExemption(\`<candidate commit message>\`));"
```
This is a sharper, more specific technique than the rule stated in (B): the rule is easy to state and easy to misapply when actually composing a multi-paragraph message with both a body and a `Co-Authored-By:` trailer, because "which paragraph is the last one" is a property of the literal final string, not of intent. Verifying against the real `parseTrailers`/`hasExemption` functions catches exactly what eyeballing missed twice in one session.

## Why This Matters

A gate that can be silently bypassed is worse than no gate: it produces false confidence that regressions are covered, so the team stops manually double-checking a thing that isn't actually being checked. Round-1-only review is the natural stopping point under time pressure — it fixes everything that was *found*, which feels complete — but "everything found" and "everything present" are different claims, and the gap between them is exactly where a second round pays for itself. The round-2 finds here (vacuous assertion-free tests, regex misparsing `.test()` method calls) are not variations on round-1's findings; they're a structurally different failure mode round 1's own fixes didn't and couldn't anticipate, because round 1 was reasoning about the code it could see, not stress-testing the fixes it had just written. The same logic applies one level down: a regression test that references the field the fix touches "looks" correct on read-through, and only an actual revert-and-rerun proves it exercises the right code path.

Round 3 confirms the pattern generalizes one level further: even a gate that has survived two adversarial-review rounds against its own logic can still fail in production because of state the reviewer never modeled — concurrent branches racing a convention to completion, long-lived branches whose merge strategy pollutes the commit range a per-commit gate reads, and CI checkout mechanics (a synthetic merge commit) that break an assumption ("index 0 is the tip") baked into the code without ever being written down as an assumption. Two of these three findings weren't bugs in the gate at all — they were the gate correctly reacting to messy branch state — which matters because the fix in those cases is process (rebase over merge, re-check file locations after a convention lands) rather than more code. Only the third was a real bug, and even there, the fix was narrowly safe (can only ever widen an exemption match, never loosen the block) precisely because the property being relaxed — "the exemption trailer can appear on any commit in the range, not just position 0" — was proven, not assumed, before shipping.

## When to Apply

- Any time you're adding a pre-commit/pre-push git hook: default to static, sub-second checks (regex/AST scans over staged content via git plumbing, not `npm test`) and push real suite execution to CI, especially if local compute cost has come up as a concern or the hook would run on every commit rather than at natural checkpoints.
- Any time you're building or hardening a mechanism whose entire job is to block bad things from merging (a commit gate, a CI required-check, a pre-merge validator, a security scanner's pass/fail wiring): budget for at least two full adversarial review rounds before trusting it, not one. Treat "round 1 passed" as "known holes fixed," not "solid."
- Any time you write a regression test for a previously-fixed bug: don't just confirm it passes against the current (fixed) code — revert the fix in a scratch copy/branch and confirm the test actually goes red. A test that never demonstrably fails against the bug it claims to guard isn't proven to guard anything.
- Any time a gate enforces a path/naming convention while that convention is still being finalized on a concurrent branch: re-check file *locations* (not just content) against the convention right before merge, especially for work started before the convention branch merged.
- Any time a long-lived branch is repeatedly synced against a fast-moving `master` under a gate that reads a commit *range* (`git rev-list base..HEAD` or equivalent): prefer rebase or cherry-pick over `git merge` for the sync, or the range will keep surfacing already-merged commits indefinitely as if they were still new.
- Any time a gate reasons about "the tip commit" or "commit index 0" of a CI-provided range: check whether the CI trigger type can interpose a synthetic commit (GitHub Actions' `pull_request` event checks out a synthetic merge commit as `HEAD`) before trusting position 0 — scan the whole range for a signal instead, when doing so is provably safe (can only find a true positive, never introduce a false one).
- Any time you hand-author a commit message meant to satisfy a gate's trailer/format rule (e.g. `Regression-Exempt:` in the last paragraph): don't just recall the documented rule — run the gate's real parsing function (e.g. `node -e "require('./scripts/regression-gate.js').hasExemption(\`...\`)"`) against the literal candidate message before pushing. This has now caught what re-reading the rule missed on at least two occasions in one session.

## Examples

- `.githooks/pre-commit` / `.githooks/commit-msg` (`master`) — both are one-line dispatches to `scripts/regression-gate.js static` / `msg`, no npm/test-runner invocation at all.
- `scripts/regression-gate.js` — `hasRealTest()` (test call + assertion count + banned-modifier check as three independent conditions) and `TEST_CALL_RE`'s `(?<![.\w$])` lookbehind are the direct code artifacts of round 2's two findings.
- `.github/workflows/ci.yml` jobs `regression-gate` (mocked jest/vitest regression suites + PR/push-range static check) and `e2e-regression` (live Postgres + backend + Expo web Playwright run, with an explicit "Verify e2e tests actually executed" step) — where suite execution actually happens.
- `frontend/src/__tests__/regression/issue-46-payer-excluded-percentage-share.test.ts` — the corrected, nested-`paidBy`-fixture version of the first seeded regression test, after the vacuous flat-`paidById` version was caught by revert-and-rerun.
- PR #74 (`chore/regression-pack-gate`, merged 2026-09-23) — its description documents both review rounds and their findings in the "How it was verified" section.
- PR #72 (`0a8eefe fix(backend): seed CNY so group save with CNY works (#50) (#72)`) — regression test relocated to match the `issue-<N>-<slug>.test.ts` convention that landed concurrently via PR #74, imports fixed, re-verified with `tsc` + the test before re-push.
- PR #78 (`f25c8bf fix(ci): decouple e2e-mobile job conclusion from android-emulator-runner teardown hang (#78)`) — the branch that exposed both the squash-merge phantom-commit issue (resolved by cherry-picking its one real commit onto fresh `master` instead of merging) and, on its second merge attempt, the synthetic-merge-commit tip-exemption false BLOCKED result that PR #81 fixed.
- PR #81 (`a3ce768 fix(ci): find tip exemption anywhere in a PR's commit range, not just commits[0] (#81)`) — the `evaluatePr()` fix itself in `scripts/regression-gate.js` (`tipExempt = commits.some((c) => hasExemption(c.message))`), with its regression test in `scripts/__tests__/regression-gate-r2.test.js` (`'PR mode: tip exemption is found anywhere in the range, not just commits[0] ...'`), confirmed red-before-green by stashing the fix and rerunning before restoring it.

## Related

- `.claude/hooks/pre-commit-quality-gate.js` and `.claude/hooks/pre-commit-gate.js` — two existing, earlier local git hooks in this repo (the tsc-check hook and the E2E-coverage/test-fix-commit-check hook respectively). The regression-pack gate documented here is layered *alongside* both, not a replacement for either. Neither has its own `docs/solutions/` entry as of this writing — `pre-commit-quality-gate.js` is referenced only in `CLAUDE.md`, `pre-commit-gate.js` only in `PROJECT_MEMORY/MIGRATIONS.md` — so this doc is, for now, the first `docs/solutions/`-level treatment of this repo's layered git-hook-plus-CI-gate architecture as a whole.
- This doc's own (B) section's `Regression-Exempt:` trailer-placement rule (`parseTrailers()` reads only the last paragraph) — reinforced by round 3's finding that the rule was violated twice more even by someone who had just read it, and was only reliably caught by running the real parser (`hasExemption()`) against the literal candidate commit message, not by re-reading the rule.
