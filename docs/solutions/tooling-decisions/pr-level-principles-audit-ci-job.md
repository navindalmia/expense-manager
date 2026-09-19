---
title: "principles-audit CI job: a PR-level backstop for local pre-commit quality-gate rules"
date: 2026-09-19
category: docs/solutions/tooling-decisions
module: .github/workflows/ci.yml, .claude/scripts/audit-pr-principles.js
problem_type: process_gap
component: ci_cd
symptoms:
  - "Local .claude/hooks/pre-commit-quality-gate.js rules (fix/feat-needs-test, UI-needs-visual-regression) only fire in a Claude Code session that has the hook installed"
  - "This repo's own cloud sandbox sessions don't have the local hook wired up (no Docker/emulators either), and have repeatedly had to use Test-Exempt/E2E-Exempt/Visual-Regression-Exempt trailers with no PR-level record of how often or why"
  - "A commit made with --no-verify, or from any tool that never invokes the hook, bypasses the rules entirely with nothing left to catch it before merge"
root_cause: process_gap
resolution_type: tooling_change
severity: medium
related_components: ["ci", "hooks", "testing", "github-actions"]
tags: [ci, pre-commit-hook, principles-audit, exempt-trailer, github-actions]
---

# principles-audit CI job: a PR-level backstop for local pre-commit quality-gate rules

## Problem

`.claude/hooks/pre-commit-quality-gate.js` mechanically enforces three rules from CLAUDE.md / PROJECT_MEMORY/05-QUALITY_STANDARDS.md at commit time: a `fix(`/`feat(` commit touching source needs a test (Rule 2), a UI-touching commit needs a visual-regression baseline (Rule 3), and — added in this change — a UI-touching commit needs real Playwright E2E specifically, not just any `e2e/`-or-`maestro-flows/` file (Rule 4, tightened out of the former Rule 1). All three are escape-hatched by an exempt trailer (`Test-Exempt:`, `Visual-Regression-Exempt:`, `E2E-Exempt:`) rather than a hard block, per the existing decision in `docs/solutions/tooling-decisions/visual-regression-hook-uses-exempt-trailer-not-hard-block.md`.

That hook is real, but it is a **local, per-session, per-commit** control. It never fires for: a commit made from an environment where the hook isn't installed (this repo's cloud sandbox sessions, which lack Docker/emulators and have repeatedly relied on the exempt trailers — see `docs/plans/2026-09-17-overnight-bugfix-log.md`), a commit made with `--no-verify`, or any tool that talks to git without going through this hook at all. Nothing at the PR level re-checked whether the rules actually held across a PR's full history, and nothing surfaced how often the exempt trailers were used or why, short of manually reading every commit message.

## Solution

Added a `principles-audit` job to `.github/workflows/ci.yml`, running on every `pull_request`:

1. Checks out with `fetch-depth: 0` so the PR's full commit range (`base.sha..head.sha`) is available, not just the merge commit's squashed diff.
2. Runs the hook's and the new audit script's own unit tests first (`node --test`), so a broken detection script fails loudly rather than silently passing every PR.
3. Runs `.claude/scripts/audit-pr-principles.js <base> <head>`, which re-evaluates the same three rules per-commit across the whole range and prints a Markdown summary.
4. Posts that summary as a PR comment via `gh pr comment` (using the job's default `GITHUB_TOKEN`, `pull-requests: write` permission), listing every commit that used an exempt trailer and its stated reason — the accountability trail a reviewer would otherwise have to dig through commit messages to find.
5. Fails the job only when a rule was violated with **no** exempt trailer. Exempt trailers themselves never fail the build — they're the repo's own documented legitimate escape hatch, not a violation.

### Why the detection logic lives in a shared module

`.claude/scripts/lib/commit-rules.js` holds the file-classification regexes (`isScreenOrComponentTsx`, `isTestFile`, `isFixOrFeatCommit`, `isMaestroVisualFile`, `isPlaywrightE2eFile`, `extractTrailer`) and is required by both `.claude/hooks/pre-commit-quality-gate.js` and `.claude/scripts/audit-pr-principles.js`. Before this change the hook defined these regexes inline; extracting them was necessary so the local hook and the CI audit check the *same* thing — two independently-maintained copies of "what counts as a screen file" or "what counts as a test file" would drift the first time either one got edited without the other, and nothing would catch it.

### Rule 4 (new): real E2E specifically, not e2e-or-maestro

The pre-existing Rule 1 accepted `e2e/` **or** `maestro-flows/` as satisfying "UI change needs E2E coverage." That let a UI commit through with only a Maestro *visual* or functional flow and zero real Playwright coverage. Added Rule 4 to the local hook (and mirrored it in the audit script) requiring `e2e/` specifically, keeping the same `E2E-Exempt:` trailer — this is the CLAUDE.md/PROJECT_MEMORY/05-QUALITY_STANDARDS.md "real E2E coverage required" principle made independently checkable from the visual-regression one, rather than silently satisfied by a Maestro-only commit.

## What this job explicitly does NOT check

Per CLAUDE.md's own Compound Engineering workflow section: whether `/ce-brainstorm`, `/ce-plan`, `/ce-code-review`, or `/ce-compound` actually ran is **not** checked here, and deliberately so. None of those are detectable from a git diff — a self-review can look identical to a dispatched `/ce-code-review` in the diff it produces — and a prior session explicitly declined to build a "blunt mechanical proxy" for them, reasoning that a proxy that can be satisfied without the real practice happening (e.g. a commit trailer claiming review happened) is worse than no check at all, since it creates false confidence. This job respects that decision rather than relitigating it. The Compound Engineering stages remain self-discipline, stated as mandatory in CLAUDE.md precisely because they can't be hooked the same way `tsc --noEmit`, test presence, or trailer presence can.

## Known limitations

- The job posts one comment per CI run, not per-push-incrementally — repeated pushes to the same PR will produce multiple audit comments over the PR's life rather than one edited comment. Acceptable for now (a human reviewer wants to see the latest one; older ones stay as history) but could be tightened to update-in-place with `gh pr comment --edit-last` if the comment volume becomes noisy in practice.
- Like the local hook, this only classifies files by path pattern — it can't verify that a staged/committed test file actually tests the change in question, only that *some* qualifying file changed in the same commit. That's an intentional trade-off (see the visual-regression hook's own doc): mechanical proxies can force disclosure, not verification.
- `isBackendOrFrontendSource` (audit script) mirrors the hook's Rule 2 scope-widening intent but is stricter than the hook's own `isTestFile`-based check in one respect: it only counts `backend/src/` or `frontend/src/` files as "source" for triggering the fix/feat-needs-test rule, so a `fix(...)` commit that only touches root-level config or non-`src/` files won't trigger the rule at either layer. This matches the task's specified scope (`fix(...)`/`feat(...)` commits touching backend or frontend *source*) rather than every file in either workspace.

## Related Issues

- Builds directly on `docs/solutions/tooling-decisions/visual-regression-hook-uses-exempt-trailer-not-hard-block.md` (PR #64) — same exempt-trailer philosophy, extended from "local commit-time" to "PR-level, full-range."
- `docs/plans/2026-09-17-overnight-bugfix-log.md` documents the concrete gap (cloud sandbox sessions lacking the local hook) that motivated this job.
