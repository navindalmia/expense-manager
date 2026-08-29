---
title: "Frontend network error on first request after Render free-tier cold start"
date: 2026-08-16
category: docs/solutions/runtime-errors
module: frontend/src/api/http
problem_type: runtime_error
component: tooling
symptoms:
  - "New/returning users hit a generic network error on the very first request after the app has been idle for a while (worst case: a brand-new user's first request ever)"
  - "Retrying the same request shortly after succeeds with no other change"
root_cause: config_error
resolution_type: config_change
severity: medium
tags: [render, cold-start, axios-timeout, free-tier, onboarding]
---

# Frontend network error on first request after Render free-tier cold start

## Problem

The live backend runs on Render's free tier, which sleeps the service after ~15 minutes of idle and takes 30-50 seconds to wake on the next request. The frontend's axios client (`frontend/src/api/http/config.ts`) had `timeout: 12000` (12 seconds) — shorter than the cold-start wake time — so the first request after any idle period reliably timed out and surfaced as a generic network error, before the backend even had a chance to respond.

## Symptoms

- Opening the app after it (or the backend) had been idle showed a network error instead of a loading state
- This was disproportionately bad for onboarding: a brand-new user's very first request is the single most likely moment to hit a cold backend

## What Didn't Work

N/A — this was found and root-caused directly (Render's own free-tier cold-start behavior was already known/documented from the initial deploy setup), not discovered through failed attempts.

## Solution

Raised `apiConfig.timeout` in `frontend/src/api/http/config.ts` from `12000` to `45000` (comfortably covers the 30-50s wake window while still failing a genuinely hung request in a reasonable time). No new UI was added — the existing timeout error message ("Request timed out. Please try again.") already flows through the current error-normalization pipeline (`frontend/src/api/http/error.ts`), so a dedicated "waking up the server" loading state wasn't warranted for this fix.

## Why This Works

The mismatch was purely a client-side timeout value shorter than a known, fixed server-side wake latency. Raising the timeout past that latency removes the false-negative network error without touching backend behavior.

## Prevention

- Added test coverage for the timeout config and for `normalizeApiError`'s handling of `ECONNABORTED`/timeout errors (`frontend/src/api/http/__tests__/config.test.ts`, `frontend/src/api/http/__tests__/error.test.ts`) — no test files existed for this module before.
- When adjusting infra that has a known cold-start/wake latency (any serverless or scale-to-zero backend), always check that client-side timeouts exceed that latency — a client timeout shorter than the platform's own documented wake time will always eventually surface as a false network error.
