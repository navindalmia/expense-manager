---
title: "Principles ratchet: fail only on NEW coding-principle violations, with a frozen baseline for existing debt"
date: 2026-11-21
category: tooling-decisions
module: principles-check
problem_type: tooling_decision
component: development_workflow
severity: medium
applies_when:
  - "a PR or review needs to know whether the diff added any, raw Error, console.*, hardcoded UI strings, unguarded routes, duplicated or oversized code"
  - "updating scripts/principles-baseline.json or exempting a rule"
---

# Principles ratchet

Audits #182 and #183 found a lot of existing debt, so a flat lint gate would block everything. `scripts/principles-check.js` is a ratchet instead: `scripts/principles-baseline.json` freezes the per-file, per-rule counts at the time it was generated, and the check fails only when a changed file's count goes up. Supersedes the earlier attempt in PR #91.

## Run it

```
node scripts/principles-check.js --base origin/staging            # text, exit 1 on new violations
node scripts/principles-check.js --base origin/staging --report   # markdown table for a PR comment
node scripts/principles-check.js --base origin/staging --json out.json
```

Flags: `--require-jscpd` (CI: failing to run jscpd is a failure, not a silent pass), `--skip-jscpd` (fast local run). Uncommitted tracked changes and untracked files are included. Thresholds live in `scripts/principles-config.json` and are read from the BASE commit, so a PR cannot loosen them. The baseline is also read from the base commit (on the bootstrap PR only, from the working tree).

## Rules

P1-any, P2-raw-error, P2-apperror-literal, P3-console, P4-jsx-string, P5-route-auth, P5-route-validation, P5-route-ratelimit, P6-func-size (80 lines), P6-file-size (400 lines), P7-duplication (jscpd, 50 tokens, added lines only), P8-missing-test (fails for services/controllers/hooks, warns otherwise), P9-unused-export (warn). Size rules store lines, so they fail only when a function or file grows. Heuristics are regex and brace based, not a parser: expect rare false positives and false negatives (for example a multi-line JSX text node that looks like code).

## Update the baseline legitimately

Only after paying debt down (counts shrink; the check prints how many improved) or in a reviewed refactor that moves code:

```
node scripts/principles-check.js --update-baseline
```

Commit the result. If any count INCREASES versus the base baseline, the check reports `BASELINE-RAISED` unless a commit in the PR carries a `Principles-Baseline-Raise: <reason>` trailer, so raising it is always a visible, reviewed decision.

## Exempt a single case

- Line level: `// principles-exempt: <rule-id> <reason>` on the line or the line above (any rule except P6-file-size). For hardcoded UI strings: `// i18n-exempt: <reason>`.
- Intentionally public, unvalidated or unlimited routes: add `"<routesFile> <METHOD> <path>"` to `scripts/principles-allowlist.json` (`publicRoutes`, `unvalidatedRoutes`, `unlimitedRoutes`).
- Whole PR: commit trailer `Principles-Exempt: <rule-id> <reason>`.

## Limits

An exemption trailer is honour-system, visible in review. A file renamed with heavy edits is matched to its old baseline via git rename detection only. Unused-export detection is a word grep, not knip. CI runs the check as the `principles-check` job (pull_request only); until the owner marks it required in branch protection it is advisory.
