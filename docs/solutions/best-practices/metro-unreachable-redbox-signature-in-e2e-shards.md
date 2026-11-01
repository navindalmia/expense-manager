---
title: "email-input never visible in every flow of one shard means a Metro redbox, not an emulator cold start"
date: 2026-10-31
category: best-practices
module: scripts/probe-metro-android.sh
problem_type: best_practice
component: testing_framework
severity: medium
applies_when:
  - "every flow of ONE e2e-mobile shard fails at 'email-input is visible' while other shards pass"
  - "the emulator log shows it booted fully and the Metro warm-up returned 200"
symptoms:
  - "all flows in one shard fail at 'email-input is visible'"
  - "failure screenshots show the red 'Unable to load script' redbox"
tags: [maestro, metro, android-emulator, ci, diagnosis, logcat, redbox]
---

# email-input never visible in every flow of one shard means a Metro redbox, not an emulator cold start

## Context

In run 40575687321, shard 1 failed `email-input is visible` in every flow. The tempting reading was an emulator cold start.

## Guidance

Download the artifacts and look, do not guess: `gh run download <run> -n maestro-debug-output-<shard>`, then read the failure screenshots and logcat.

- OBSERVED: the screenshots showed the red "Unable to load script" redbox; logcat had `Failed to connect to /10.0.2.2:8081`. The emulator was fully booted and the Metro warm-up had returned 200.
- OBSERVED: `adb reverse` does not affect the 10.0.2.2 route, so re-running it is not a remedy for this signature.
- NOT ESTABLISHED: why the emulator-to-host link was dead. Do not cite this doc as a root cause.

Mitigation (PR #163): `scripts/probe-metro-android.sh` runs before the flows, polls Metro at 10.0.2.2:8081 from inside the emulator, and fails fast with `::error::cold-start: ...` instead of burning every flow. Note the label `cold-start:` is the script's own name for this failure; it is a misnomer relative to the diagnosis above.

Distinguish from the stale-baseline signature (`Comparison error ... current: 88.36%` on every run): see the 2026-10-31 section of `docs/solutions/build-errors/e2e-mobile-ci-hang-and-cascading-fixes.md`.

## When to Apply

- One shard fails uniformly at the first login assertion. Check for the redbox before touching flows or baselines.

## Related

- PR #163. `docs/solutions/test-failures/maestro-retry-classifier-matched-text-in-every-failure-log.md`
