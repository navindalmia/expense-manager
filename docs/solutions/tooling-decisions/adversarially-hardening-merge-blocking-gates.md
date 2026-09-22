---
title: "Building the regression pack: CI-only test execution, and why a merge-blocking gate needs two adversarial review rounds"
date: 2026-09-22
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
related_components: ["testing_framework", "tooling"]
tags: [regression-pack, pre-commit-hooks, ci-gating, adversarial-review, bypass-resistance, red-before-green, test-quality, git-hooks]
---

# Building the regression pack: CI-only test execution, and why a merge-blocking gate needs two adversarial review rounds

## Context

Building a "regression pack" for this repo (PR #74, branch `chore/regression-pack-gate`, open/pending merge at time of writing) — one test per fixed bug, wired so a regression can never land silently again — surfaced two lessons worth keeping independent of this specific repo: where test *execution* should live relative to git hooks, and how many adversarial-review rounds a merge-blocking gate actually needs before it can be trusted.

**All paths cited in this doc exist on the `chore/regression-pack-gate` branch (PR #74), verified present there as of this writing — the PR is open/unmerged, so none of them are on `master` yet.** Re-verify against `master` once #74 merges; a path flagged missing by an automated doc-claims check after that point means it moved or was renamed, not that this doc was wrong when written.

The pack itself lives at `backend/src/__tests__/regression/`, `frontend/src/__tests__/regression/`, `e2e/regression/`, one `issue-<N>-<slug>.test.ts` per fixed bug. It's gated by `.githooks/pre-commit`, `.githooks/commit-msg`, `scripts/regression-gate.js`, `scripts/install-hooks.js`, and CI jobs `regression-gate` / `e2e-regression` in `.github/workflows/ci.yml`.

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

## Why This Matters

A gate that can be silently bypassed is worse than no gate: it produces false confidence that regressions are covered, so the team stops manually double-checking a thing that isn't actually being checked. Round-1-only review is the natural stopping point under time pressure — it fixes everything that was *found*, which feels complete — but "everything found" and "everything present" are different claims, and the gap between them is exactly where a second round pays for itself. The round-2 finds here (vacuous assertion-free tests, regex misparsing `.test()` method calls) are not variations on round-1's findings; they're a structurally different failure mode round 1's own fixes didn't and couldn't anticipate, because round 1 was reasoning about the code it could see, not stress-testing the fixes it had just written. The same logic applies one level down: a regression test that references the field the fix touches "looks" correct on read-through, and only an actual revert-and-rerun proves it exercises the right code path.

## When to Apply

- Any time you're adding a pre-commit/pre-push git hook: default to static, sub-second checks (regex/AST scans over staged content via git plumbing, not `npm test`) and push real suite execution to CI, especially if local compute cost has come up as a concern or the hook would run on every commit rather than at natural checkpoints.
- Any time you're building or hardening a mechanism whose entire job is to block bad things from merging (a commit gate, a CI required-check, a pre-merge validator, a security scanner's pass/fail wiring): budget for at least two full adversarial review rounds before trusting it, not one. Treat "round 1 passed" as "known holes fixed," not "solid."
- Any time you write a regression test for a previously-fixed bug: don't just confirm it passes against the current (fixed) code — revert the fix in a scratch copy/branch and confirm the test actually goes red. A test that never demonstrably fails against the bug it claims to guard isn't proven to guard anything.

## Examples

- `.githooks/pre-commit` / `.githooks/commit-msg` (`chore/regression-pack-gate` branch) — both are one-line dispatches to `scripts/regression-gate.js static` / `msg`, no npm/test-runner invocation at all.
- `scripts/regression-gate.js` — `hasRealTest()` (test call + assertion count + banned-modifier check as three independent conditions) and `TEST_CALL_RE`'s `(?<![.\w$])` lookbehind are the direct code artifacts of round 2's two findings.
- `.github/workflows/ci.yml` jobs `regression-gate` (mocked jest/vitest regression suites + PR/push-range static check) and `e2e-regression` (live Postgres + backend + Expo web Playwright run, with an explicit "Verify e2e tests actually executed" step) — where suite execution actually happens.
- `frontend/src/__tests__/regression/issue-46-payer-excluded-percentage-share.test.ts` — the corrected, nested-`paidBy`-fixture version of the first seeded regression test, after the vacuous flat-`paidById` version was caught by revert-and-rerun.
- PR #74 (`chore/regression-pack-gate`, open at time of writing) — its description documents both review rounds and their findings in the "How it was verified" section.

## Related

- `.claude/hooks/pre-commit-quality-gate.js` and `.claude/hooks/pre-commit-gate.js` — two existing, earlier local git hooks in this repo (the tsc-check hook and the E2E-coverage/test-fix-commit-check hook respectively). The regression-pack gate documented here is layered *alongside* both, not a replacement for either. Neither has its own `docs/solutions/` entry as of this writing — `pre-commit-quality-gate.js` is referenced only in `CLAUDE.md`, `pre-commit-gate.js` only in `PROJECT_MEMORY/MIGRATIONS.md` — so this doc is, for now, the first `docs/solutions/`-level treatment of this repo's layered git-hook-plus-CI-gate architecture as a whole.
