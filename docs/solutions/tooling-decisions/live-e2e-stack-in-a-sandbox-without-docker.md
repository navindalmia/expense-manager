---
title: "Standing up the real E2E stack (Postgres + backend + Expo web) in a sandbox with no Docker daemon"
date: 2026-09-19
category: docs/solutions/tooling-decisions
module: local dev environment / E2E setup
problem_type: tooling_gap
component: ci_cd
symptoms:
  - "docker-compose (this repo's documented dev-database setup) is unusable because the Docker daemon itself cannot start"
  - "npx expo start --web crashes outright (not just slowly) with a JSON-parse error instead of starting Metro"
root_cause: environment_constraint
resolution_type: workaround
severity: low
related_components: ["e2e-testing", "local-dev", "postgres", "expo"]
tags: [docker, postgres, expo, e2e, sandbox, playwright]
---

# Standing up the real E2E stack in a sandbox with no Docker daemon

## Problem

This repo's documented local dev setup uses `docker-compose` for Postgres (`README.md`, `.devcontainer/`). A cloud sandbox session needed a genuinely live backend+DB+frontend stack to write and verify real Playwright E2E tests (per this repo's own standing rule that mocked tests alone don't prove a user-facing feature works), but Docker wasn't usable there at all.

## Symptoms

- `docker ps` → `failed to connect to the docker API at unix:///var/run/docker.sock: ... no such file or directory`.
- `service docker start` → `ulimit: error setting limit (Operation not permitted)`, then the same socket-connect failure.
- Separately, once a workaround database was running: `npx expo start --web` failed immediately with `SyntaxError: Unexpected token 'H', "Host not i"... is not valid JSON`, thrown from Expo CLI's own dependency-version-check step trying to reach `expo.dev`'s API, which this sandbox's network policy blocks (returning an HTML error page where Expo's CLI expected JSON).

## Root Cause

The sandbox environment has no privilege to run a Docker daemon (container-in-container networking/cgroups aren't available), and no path to fix that from inside the session. Separately, Expo CLI's `startAsync` unconditionally runs an online "validate installed native module versions against expo.dev" check before starting Metro, with no built-in flag to skip it other than explicit offline mode.

## Solution

- **Postgres**: this sandbox image has PostgreSQL 16 installed as a regular system package (not via Docker) — `service postgresql start` brings it up directly. Created the `admin`/`admin123`/`expense_db` user+database to match `backend/.env.example`'s `DATABASE_URL` exactly, then ran `npx prisma migrate deploy` and `npm run seed` against it with `DATABASE_URL` exported in the shell (the app itself loads `.env.local` via `dotenv` at startup, but the bare Prisma CLI does not — it needs the var directly in the environment for `migrate`/`generate`/`seed` commands run standalone).
- **Expo web**: `EXPO_OFFLINE=1 npx expo start --web` — this flag makes Expo CLI skip the online dependency-version check entirely ("Skipping dependency validation in offline mode") instead of crashing when it can't reach `expo.dev`.
- **Frontend → backend wiring for web**: per this repo's own prior CI fix (see `docs/solutions/build-errors/e2e-mobile-ci-hang-and-cascading-fixes.md`'s sibling web fix), `EXPO_PUBLIC_API_BASE_URL` must be set via `frontend/.env.development.local` (gitignored) specifically — Expo's `EXPO_PUBLIC_*` resolution re-parses `.env*` files directly and never reads `process.env`, so an exported shell variable or CI job-level env var has no effect on it.
- **Playwright's own browser binary**: this sandbox pre-installs Chromium at a fixed path (`/opt/pw-browsers/chromium`) outside of `npx playwright install`, but the exact build number can mismatch what a given `@playwright/test` version expects by default (`chromium_headless_shell-1234` looked for, `-1194` present) — passed `launchOptions: { executablePath: '/opt/pw-browsers/chromium' }` in `playwright.config.ts` to force it, then reverted that line before committing (it's a sandbox-local path, not something to commit to the shared config).

## Why This Works

Nothing in the actual application under test cares whether its Postgres came from Docker or a native package install, or whether Expo's dependency-version check ran — both are pure tooling/CLI concerns around getting the real stack running, not application behavior. Once the real processes are up and correctly wired, Playwright drives them exactly the same way CI's own `e2e-web` job does.

## Prevention

- When a documented dev-setup path (Docker) is unavailable in a given environment, check first whether the underlying tool (Postgres, in this case) is available as a plain system install before assuming E2E work is blocked entirely.
- `EXPO_OFFLINE=1` is worth trying by default in any sandboxed/network-restricted environment before concluding `expo start` can't run there at all — the failure mode (a crash, not a hang) looks more fatal than it is.
- Any `executablePath` override for Playwright's browser is sandbox-specific — never commit it; revert `playwright.config.ts` before staging a real commit, exactly like any other local-only workaround (`.env.local`, `.env.development.local`).

## Related Issues

- `docs/solutions/build-errors/e2e-mobile-ci-hang-and-cascading-fixes.md` — the `EXPO_PUBLIC_API_BASE_URL` / `.env.development.local` fact this reuses was originally discovered fixing CI's own `e2e-web` job, not in this sandbox context.
- Enabled real E2E coverage for issues #50/#51 and #47 in the 2026-09-18/19 overnight session (see `docs/plans/2026-09-17-overnight-bugfix-log.md`).
