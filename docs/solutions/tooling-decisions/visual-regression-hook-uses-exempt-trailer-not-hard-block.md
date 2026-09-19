---
title: "Visual-regression pre-commit rule uses an exempt trailer, not a hard block, because most dev environments can't verify a screenshot baseline"
date: 2026-09-19
category: docs/solutions/tooling-decisions
module: pre-commit-quality-gate hook
problem_type: process_gap
component: ci_cd
symptoms:
  - "A full overnight bugfix session shipped real UI changes (new buttons, new picker behavior) with complete functional test coverage (unit + real Playwright E2E) but zero pixel-level visual-regression coverage, and nothing caught the gap before commit"
root_cause: process_gap
resolution_type: tooling_change
severity: low
related_components: ["hooks", "testing", "maestro"]
tags: [pre-commit-hook, visual-regression, maestro, screenshot, exempt-trailer]
---

# Visual-regression pre-commit rule uses an exempt trailer, not a hard block

## Problem

This repo has a real pixel-diff visual-regression mechanism (Maestro's `assertScreenshot`, `maestro-flows/visual/*.yaml`, 3 baselined screens: login, group list, expense list), but nothing connected "a commit touches a screen/component" to "did you consider whether the visual baseline needs an update." `.claude/hooks/pre-commit-quality-gate.js` already hard-enforced functional E2E coverage for UI changes (Rule 1) and a regression test for `fix(...)` commits (Rule 2), but neither rule says anything about visual regression, and a `feat(...)` commit for a brand-new UI feature wasn't required to have any regression test at all (only `fix(` triggered Rule 2).

## Why a hard block doesn't work here

Generating or verifying a Maestro screenshot baseline requires a real Android emulator. Several real environments this project is actively used from — including this repo's own cloud sandbox sessions — have no such emulator access at all (confirmed directly: Docker's daemon isn't available, and there's no lighter-weight substitute for an emulator-based screenshot). A hook rule requiring an actual baseline update on every UI-touching commit would fail closed in exactly the environments where real bugfix/feature work legitimately still needs to happen, blocking all of them permanently rather than surfacing a real risk.

## Solution

Added Rule 3 to `pre-commit-quality-gate.js`: a commit touching `frontend/src/screens/**/*.tsx` or `frontend/src/components/**/*.tsx` must also touch a `maestro-flows/visual/*.yaml` file, **or** the commit message must carry a `Visual-Regression-Exempt: <reason>` trailer — the same pattern already used for `E2E-Exempt:` and `Test-Exempt:`. Also broadened Rule 2 from `fix(`-only to `fix(` or `feat(`, so new features get a regression test the same way bug fixes do.

## Why This Works

The trailer doesn't guarantee a baseline was actually checked — nothing mechanical can guarantee that without the emulator itself being available everywhere commits happen — but it forces a **recorded, deliberate** decision on every UI commit instead of silence. A reviewer (human or a later `/ce-code-review` pass) can grep commit history for `Visual-Regression-Exempt:` trailers and ask whether the stated reason actually held, which a silently-missing check gives no way to do at all.

## Known limitation (flagged, not resolved)

A `/code-review` pass on this exact change noted the honest risk: since real baseline verification is unavailable in most environments, `Visual-Regression-Exempt:` risks becoming a rubber-stamped habit rather than a considered call — identical in kind to the pre-existing risk with `E2E-Exempt:`/`Test-Exempt:`. There is no code fix for this; it's a process-discipline risk the trailer mechanism surfaces but cannot itself prevent. Worth periodically auditing (e.g. during the monthly doc-staleness scrub, [[ai_workflow]] item 40) whether exempt trailers across the repo's history look like genuine judgment calls or reflexive boilerplate.

## Prevention

- When a repo has a real regression-testing mechanism (visual baselines, contract tests, etc.) that isn't universally runnable, prefer an exempt-trailer pre-commit rule over either (a) a hard block that fails closed everywhere, or (b) no mechanical check at all (silent gap). The trailer is a middle ground: it can't force verification, but it forces disclosure.
- When broadening an existing hook rule's trigger condition (here: `fix(` → `fix(`or `feat(`), grep for every doc that describes the old, narrower behavior (CLAUDE.md's condensed enforcement summary, PROJECT_MEMORY's full quality-standards doc) and update them in the same change — a hook change and its own documentation drifting apart is exactly the class of bug this project's monthly doc-scrub rule exists to catch, but catching it immediately is cheaper than waiting for the next scrub.

## Related Issues

- Session-wide gap identified 2026-09-19: PRs #61 (currency picker) and #63 (delete-group UI) shipped with full functional coverage but no visual-regression coverage, prompting this hook addition.
