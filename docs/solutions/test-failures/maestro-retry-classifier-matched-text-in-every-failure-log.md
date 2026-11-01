---
title: "CI retry classifier matched boilerplate that Maestro prints on every failure, so the retry never fired"
date: 2026-10-31
category: test-failures
module: scripts/run-maestro-ci.sh
problem_type: test_failure
component: testing_framework
symptoms:
  - "every failed flow logged 'failure is not a launch/infrastructure failure; not retrying', including 'email-input is visible' failures that were meant to be retried"
  - "a retry rule existed and had unit tests, yet never triggered in real CI"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [maestro, ci, retry, log-classification, assertscreenshot, regex]
---

# CI retry classifier matched boilerplate that Maestro prints on every failure, so the retry never fired

## Problem

`is_retryable` in `scripts/run-maestro-ci.sh` decides whether a failed flow is re-run. Its non-retryable rule matched the bare word `screenshot`. Maestro prints `==== Debug output (logs & screenshots) ====` in every failure log, so every failure was classified as a screenshot failure and never retried. The `email-input is visible` retry therefore never fired (OBSERVED: the log line `failure is not a launch/infrastructure failure; not retrying` appeared on every flow in the real log of run 40575687321, shard 1).

## Solution

Fixed in PR #163. The rule now matches only the specific comparison wording (read at the current tree, `scripts/run-maestro-ci.sh`):

```bash
grep -qE 'Comparison error|Image comparison|Assertion is false: .*[Ss]creenshot' "$2"
```

with a comment that the bare word is deliberately not matched. The real `assertScreenshot` failure wording, from run 40574113460, is `Comparison error: Assert screenshot matches login-screen (threshold: 95%) - threshold not met, current: 88.36...%`.

## Prevention

- Classify failures on specific text, not on a word that also appears in the tool's boilerplate.
- Test a classifier against REAL captured log text from a failed run, not hand-written strings. Hand-written fixtures contain only the words the author thought of, which is how a rule can pass its tests and be dead in production.
- When a retry is supposed to exist, check that its "retrying" log line has ever appeared in a real run.

## Related

- PR #163. `docs/solutions/build-errors/e2e-mobile-ci-hang-and-cascading-fixes.md`
- `docs/solutions/best-practices/metro-unreachable-redbox-signature-in-e2e-shards.md`
