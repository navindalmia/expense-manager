---
title: Testing a branch on a real phone against a local backend (Expo Go SDK mismatch, emulator env file, local DB)
date: 2026-10-04
category: docs/solutions/developer-experience
module: frontend
problem_type: developer_experience
component: tooling
severity: medium
applies_when:
  - "Manually testing a branch on a physical Android phone before merging"
  - "The phone shows 'Project is incompatible with this version of Expo Go'"
  - "The app opens but login fails with 'Network error. Check your connection.'"
tags: [expo-go, expo-sdk, android, metro, local-backend, docker, prisma, env-files]
---

# Testing a branch on a real phone against a local backend (Expo Go SDK mismatch, emulator env file, local DB)

## Context

CI cannot prove UI behavior such as the keyboard not covering a picker, so PR #90 was tried on a physical phone against a backend and Postgres running on the laptop. Four separate things went wrong before it worked. None is a bug in the app.

## Guidance

**1. Expo Go must match the project's SDK.** The project is on SDK 54 (`frontend/package.json:20`, `"expo": "~54.0.37"`). Expo Go from the Play Store updates itself to the newest SDK (it was SDK 57 on 2026-10-04), so the phone showed `Project is incompatible with this version of Expo Go` (installed SDK 57, project SDK 54). It worked in earlier months only because the installed Expo Go was still SDK 54, not because anything in the repo changed. Options: install the SDK 54 Expo Go (the Play Store only carries the latest, so use the older-version download linked from the error screen; uninstall the newer Expo Go first), or upgrade the project. A throwaway upgrade experiment (SDK 57, React Native 0.86) bundled and passed `tsc`, the frontend tests and `expo-doctor` after removing `newArchEnabled`, `splash` and `android.edgeToEdgeEnabled` from `app.json`, but it was not adopted: it needs a new native build and reinstall on every device, and over-the-air updates cannot cross SDK versions.

**2. `frontend/.env.development` is tracked and points at the emulator.** It sets `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000/api` (line 16). `10.0.2.2` is the Android emulator's alias for the host machine; a real phone cannot reach it, and the failure looks exactly like a network error. Passing `EXPO_PUBLIC_API_BASE_URL=http://<laptop-LAN-IP>:4000/api` to `expo start` was not enough: the bundle contained both addresses (the CLI-injected one and a bundled copy of the env file) and the app sent requests to the wrong one. Preferred fix: put the override in `frontend/.env.local`, which is gitignored (`.gitignore:35`, pattern `.env*.local`) and takes precedence over `.env.development`, so no tracked file is touched. (In this session the tracked file's value was edited in a throwaway worktree instead, which also works but risks being committed by accident.) Then restart Metro with `--clear`, force-close and reopen Expo Go on the phone (a background reload keeps the stale bundle), and confirm the bundle contains only the LAN address:

```bash
curl -s -o bundle.js "<launchAsset url from: curl -H 'expo-platform: android' -H 'Accept: application/expo+json' http://<ip>:8081>"
grep -aoE "http://(10\.0\.2\.2|<ip>):4000/api" bundle.js | sort | uniq -c
```

A missing login request in the backend log is the tell that requests never arrived.

**3. Backend and database.** `backend/src/server.ts:14` calls `app.listen(PORT, ...)` with no host, so it listens on all interfaces; check with `curl http://<ip>:4000/api/health` (a 404 still means reachable). The database container is named in `docker-compose.yml:6` (`container_name: expense-manager-db`) and may already exist with local data, so `docker compose up` fails with a name conflict; use `docker start expense-manager-db`. Apply migrations with `npx prisma migrate deploy`, not `npm run migrate`, which is `prisma migrate dev --name init` (`backend/package.json:15`) and can prompt to reset. A fresh worktree has no `node_modules` and no gitignored env files: run `npm ci` in `backend/` and `frontend/`, then `npx prisma generate`, and copy `backend/.env`, `backend/.env.local` from the main checkout.

**4. Showing a QR code.** Expo prints its QR only to an interactive terminal; a backgrounded Metro prints none. Print one with the `qrcode-terminal` package already in `frontend/node_modules`, or type `exp://<ip>:8081` under Enter URL manually in Expo Go. The phone and laptop must be on the same Wi-Fi.

Also: `backend/.env.local` holds hosting-provider API keys. When searching env files, print variable names only or mask values (`sed -E 's/=.*/=<set>/'`); an unmasked `grep` once printed two keys into a session transcript.

## Why This Matters

Each of these failures presents as a generic error on the phone, and the instinct is to suspect the feature under test. They are environment problems and take minutes to rule out once known.

## When to Apply

Any manual phone test of a branch against a local backend, and any time the phone's Expo Go has updated since the last test.

## Examples

Verification order that worked: `lsof -iTCP:4000 -sTCP:LISTEN`, `curl http://<ip>:4000/api/health`, `curl http://<ip>:8081/status`, bundle grep for the API address, then the phone.

## Related

- `docs/solutions/build-errors/dependabot-expo-sdk-drift-and-debug-build-needs-metro.md` (SDK drift from dependency bumps, a different cause of the same compatibility class)
- `docs/solutions/tooling-decisions/eas-update-ota-for-android-preview-distribution.md` (why OTA updates cannot cross an SDK change)
