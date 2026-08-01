---
title: Render backend + Neon Postgres + EAS Android build fails on free-tier deploy config gaps
date: 2026-08-01
category: docs/solutions/build-errors
module: deploy
problem_type: build_error
component: tooling
symptoms:
  - "Render deploy fails: npm error Missing script: \"build\""
  - "Render deploy fails: error TS2688: Cannot find type definition file for 'jest' (after adding build script)"
  - "EAS Build fails in 15 seconds during Install Dependencies phase with 'Unknown error. See logs of the Install dependencies build phase for more information.'"
  - "EAS build log (fetched via eas-cli build:view --json, brotli-decoded) shows npm error ERESOLVE: peer react@\"^18.0.0\" from @testing-library/react@14.3.1 conflicts with react@19.1.0"
root_cause: config_error
resolution_type: config_change
severity: medium
tags: [render, neon, eas-build, free-tier, deploy, npm-ci, peer-deps, node-env]
---

# Render backend + Neon Postgres + EAS Android build fails on free-tier deploy config gaps

## Problem

Standing up a fully free-tier deploy (Render for the Express backend, Neon for Postgres, EAS Build for an Android internal-distribution APK) failed at three separate points, each with a misleading or generic error, because the backend had never been deployed anywhere before (previously local-only, see `[[deploy-test-workflow]]` in project memory) and its `package.json` had no production build path.

## Symptoms

- `npm error Missing script: "build"` — Render's build step failed immediately because `backend/package.json` only had a `dev` script (`ts-node-dev`), never a production `build`/`start` pair.
- After adding a `build` script, Render failed again with `error TS2688: Cannot find type definition file for 'jest'` — happened even though `@types/jest` is a real, present devDependency.
- EAS Build failed the "Install dependencies" phase in ~15 seconds with only `Unknown error. See logs of the Install dependencies build phase for more information.` in the CLI output — no actionable detail in `eas-cli build:view` either.

## What Didn't Work

- Assuming `render.yaml` (committed to repo root) would be picked up automatically — it was not. Render's **manual "New Web Service" form** (as opposed to a Blueprint deploy) ignores `render.yaml` entirely; the actual build/start commands live only in the dashboard's Settings UI for that service. Editing `render.yaml` after the fact had zero effect until the same values were re-entered in the dashboard form.
- Retrying the EAS build with `--clear-cache` alone, assuming the first failure was transient (a 15-second failure looked too fast to be a real dependency resolution run) — it failed identically the second time, proving it was deterministic, not transient.
- Reading `eas build:view <id>` for the failure detail — its plain output only repeats "Unknown error," no phase-level log content.

## Solution

**1. Render build script missing** — added to `backend/package.json`:
```json
"build": "prisma generate && tsc",
"start": "node dist/src/server.js",
"migrate:deploy": "prisma migrate deploy"
```
Note the `start` path: this repo's `backend/tsconfig.json` sets `"rootDir": "."` (not `./src`), so compiled output nests under `dist/src/server.js`, not a flat `dist/server.js`.

**2. Render's `NODE_ENV=production` silently skips devDependencies** — `tsc`, `prisma`, and `@types/jest` are all devDependencies, but Render's default `npm install` under `NODE_ENV=production` omits them, so the build step that needs `tsc` can't find its own type definitions. Fixed by forcing dev deps in explicitly, as the actual **Render dashboard Build Command** (not just `render.yaml`, per the point above):
```
npm install --include=dev && npm run build
```

**3. EAS Build's `npm ci` enforces strict peer-dependency resolution that local `npm install` silently tolerates** — `@testing-library/react@14.3.1` (a devDependency) declares a peer dependency on `react@^18.0.0`, but the app runs `react@19.1.0`. Local `npm install` had already resolved this without complaint (npm's default install is lenient), masking the conflict until EAS's `npm ci` — which fails hard on unresolved peer deps — hit it fresh in a clean container. Fixed with `frontend/.npmrc`:
```
legacy-peer-deps=true
```

**Getting real EAS build logs when the CLI/dashboard only shows "Unknown error":**
```bash
npx eas-cli build:view <build-id> --json   # gives you logFiles[0]: a short-lived (900s) signed GCS URL
curl -sI "<that url>"                       # check content-encoding — it was 'br' (Brotli), not gzip
brotli -d downloaded.log -o decoded.log     # decode with the brotli CLI, not gunzip
# decoded.log is JSON-lines; grep for the failing phase:
python3 -c "
import json
for line in open('decoded.log'):
    d = json.loads(line)
    if d.get('phase') == 'INSTALL_DEPENDENCIES' or d.get('level', 0) >= 40:
        print(d.get('msg'))
"
```
The signed URL expires in 15 minutes — if `curl` returns a non-gzip binary blob that also fails `brotli -d`, the URL likely expired; re-fetch a fresh one via `build:view --json` rather than assuming a broken pipeline.

## Why This Works

Each fix closes a gap between "works via lenient local dev tooling" and "works via the strict tooling a clean CI/build container actually runs": Render's dashboard form is the real config source of truth for non-Blueprint deploys regardless of what's committed to `render.yaml`; `NODE_ENV=production` changing `npm install`'s default dependency set is documented npm behavior but easy to miss when the build step itself needs devDependencies; and `npm ci`'s strict peer-dep resolution is npm's intentional stricter mode for reproducible CI installs, which surfaces conflicts `npm install` papers over.

## Prevention

- When deploying to Render via the dashboard (not a Blueprint), treat the dashboard's Build/Start Command fields as authoritative — `render.yaml` in the repo is not consulted unless the service was created as a Blueprint. Keep both in sync manually, or migrate to a Blueprint deploy if `render.yaml` should be the single source of truth.
- Any backend deployed with `NODE_ENV=production` needs `npm install --include=dev` (or an explicit non-production install step) if the build itself depends on devDependencies like `typescript`/`prisma`/`@types/*`.
- Before adding a new devDependency with a peer-dependency constraint (e.g. testing libraries), check it against the app's actual runtime dependency versions — `npm install` locally won't complain, but `npm ci` (used by EAS Build and most CI systems) will fail on the same conflict in a clean environment.
- For any future "Unknown error" from EAS Build with no actionable detail, use the `eas-cli build:view --json` → signed log URL → `brotli -d` → JSON-lines-grep pipeline above rather than guessing from the truncated CLI summary.

## Related Issues

None yet — this was the first cloud deployment of this app; see project memory `project_infra_deploy.md` for the full free-tier stack decision (Render + Neon + EAS, Azure and Play Store explicitly deferred).
