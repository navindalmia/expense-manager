---
title: Dependabot bumps break Expo SDK compatibility; CI debug build needs live Metro
date: 2026-08-31
category: docs/solutions/build-errors
module: frontend
problem_type: build_error
component: tooling
symptoms:
  - "EAS Android build fails with UNKNOWN_ERROR, 'See logs of the Bundle JavaScript build phase'"
  - "Local Metro bundler TransformError in react-native-screens/src/fabric/SearchBarNativeComponent.ts: 'The first argument of method blur must be of type React.ElementRef<>'"
  - "App shows a red 500 error screen on launch: 'The development server returned response error code: 500'"
  - "Maestro flow assertions fail immediately after app launch (element never appears) because the JS bundle never loaded"
root_cause: config_error
resolution_type: dependency_fix
severity: high
tags: [dependabot, expo, expo-updates, react-native, maestro, eas-build, ci, metro, supply-chain]
---

# Dependabot bumps break Expo SDK compatibility; CI debug build needs live Metro

## Problem

Two separate real regressions surfaced in one session, both from a routine batch of Dependabot dependency merges — Dependabot's semver-based bumping has no awareness of Expo's SDK compatibility matrix, and pushed several native-module packages to versions the pinned Expo SDK doesn't support.

## Symptoms

- Every EAS Android build after the merge errored in the "Bundle JavaScript" phase (`UNKNOWN_ERROR`).
- Locally, launching the app on a real Android emulator showed a Metro `TransformError` inside `react-native-screens`' fabric codegen — not a JS logic bug, a native-codegen incompatibility.
- A Maestro flow that had been passing minutes earlier suddenly failed at the very first `assertVisible` — the screen never rendered at all.

## Root Cause

Dependabot's `frontend-minor-patch` grouped PR (12 packages) and an individual `expo-updates` PR both landed the same day. Individually they looked like safe minor/patch semver bumps, but several of them were **major** jumps in Expo's own versioning scheme, which doesn't track plain semver against the SDK:

| Package | Bumped to | Expo SDK 54's actual compatible version |
|---|---|---|
| `expo-updates` | `~57.0.19` | `~29.0.20` |
| `react-native` | `0.87.1` | `0.81.5` |
| `react` / `react-dom` | `19.2.8` | `19.1.0` |
| `react-native-screens` | `4.27.0` | `~4.16.0` |
| `react-native-safe-area-context` | `5.9.1` | `~5.6.0` |
| `@react-native-async-storage/async-storage` | `1.24.0` | `2.2.0` |
| `expo` | `54.0.10` | `~54.0.37` |
| `@types/react` | `19.2.18` | `~19.1.10` |

`react-native` jumping ~6 minor versions past what SDK 54 expects broke `react-native-screens`' native codegen — which is why the error surfaced in a *different* package than the one that actually got bumped wrong.

A second, separate bug was found while first trying to run a new CI job against this: `expo run:android --no-bundler` (used to avoid `expo run:android` starting its own Metro instance) skips starting Metro *at all*. A debug-variant Android build does not embed the JS bundle the way a release build does — it fetches it live from Metro over `adb reverse`. With no Metro running and no manual step to start one, the installed app has no JS to run and immediately red-boxes.

## Solution

**For the SDK-drift bug:** don't manually pin each package back to its old version — use Expo's own compatibility resolver, which knows the real matrix Dependabot doesn't:

```bash
npx expo install --check   # lists every package outside the SDK's compatible range
npx expo install --fix     # resolves and installs all of them to Expo-endorsed versions
npx tsc --noEmit           # confirm nothing else broke
```

**For the CI debug-build bug:** start Metro explicitly before building, wait for it to be ready, then build with `--no-bundler` (reusing the already-running instance) and wire the port. The snippet below was corrected 2026-09-01 (see the [Update note](#update-2026-09-01) below) — the naive multi-line version this doc originally showed here does not work inside `reactivecircus/android-emulator-runner`'s `script:` input, and caused a real 6-hour CI hang:

```bash
# Must be ONE physical line if this runs inside reactivecircus/android-emulator-runner's
# `script:` input - see the Update note below for why.
set -m
npx expo start & METRO_PID=$!
trap 'kill -- -"$METRO_PID" 2>/dev/null || kill "$METRO_PID" 2>/dev/null || true' EXIT
npx wait-on tcp:8081 --timeout 120000
npx expo run:android --variant debug --no-bundler
adb reverse tcp:8081 tcp:8081
# ...run tests...
```

## Prevention

- After any Dependabot merge that touches `frontend/package.json` (especially anything Expo/React-Native related), run `npx expo install --check` before assuming the merge was safe — a green `tsc`/test run does **not** catch this class of bug, since it's a native-build-time failure, not a type error.
- If a future CI job needs to run a *debug*-variant Android build, remember it needs a live Metro instance reachable via `adb reverse` — only a *release* build embeds the JS bundle. This is easy to get backwards when copying patterns from release-build CI examples.

## Update (2026-09-01)

The CI debug-build snippet above was corrected. The original multi-line version shown in this doc (plain `npx expo start &` / `METRO_PID=$!` / ... / `kill "$METRO_PID" || true`, each on its own line) works fine in an ordinary shell script, but **not** when embedded in `reactivecircus/android-emulator-runner`'s `script:` input — that action runs each line as its own independent `sh -c` subprocess, so the backgrounded Metro PID captured on one line is empty by the next line, and `kill "$METRO_PID"` kills nothing. The orphaned Metro process then blocked the emulator-runner's own shutdown cleanup and hung an actual CI job for 6 hours before GitHub force-cancelled it.

This doc's own scope is the Expo-SDK-compatibility bug and the general "debug builds need live Metro" principle — both still accurate as originally written. The full incident, the process-group-kill fix (`set -m` + `kill -- -"$PID"`), and everything else needed to get the `e2e-mobile` job to a trustworthy green run (backend service, E2E fixtures, an emulator ANR, and a known unresolved upstream action bug) is documented separately: see [`e2e-mobile-ci-hang-and-cascading-fixes.md`](./e2e-mobile-ci-hang-and-cascading-fixes.md).
