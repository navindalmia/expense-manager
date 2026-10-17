---
title: "feat: staging environment between PRs and production"
type: feat
status: draft
date: 2026-10-10
---

# feat: Staging environment (staging branch, backend, DB, Android app, release notes)

## Goal and owner requirements

After PR #90 lands, nothing reaches `master` unless the owner approves. Work lands on a long-lived `staging` branch, auto-deploys to a separate staging backend + test DB, and is testable in a separate installable Android staging app. Promotion to `master` is only an owner-approved PR `staging -> master`. Release notes are generated for every staging and master release. Free tier only.

## Verified facts (cites checked 2026-10-10)

- `.github/workflows/ci.yml:3-6` triggers on `pull_request` and `push` to `master` only. A `staging` push triggers nothing today.
- `ci.yml:256-271` `deploy-backend`: `needs: [backend-test, frontend-test]`, `if: github.ref == 'refs/heads/master' && github.event_name == 'push'`, curl POST to `api.render.com/v1/services/srv-d9n52drl550s739au83g/deploys` with `secrets.RENDER_API_KEY`.
- `render.yaml`: one service `expense-manager-backend`, plan free, `startCommand: npm run migrate:deploy && npm run seed && npm start`, `DATABASE_URL` is `sync: false`.
- `backend/package.json`: `migrate:deploy` = `prisma migrate deploy`; `seed` = `npx ts-node prisma/seed.ts`.
- `.github/workflows/eas-build.yml`: push to master with `frontend/**` paths; `build` job (profile `preview`, `--no-wait`) and `update` job (`eas update --branch preview`); message is the head commit message.
- `frontend/eas.json`: `preview` sets `EXPO_PUBLIC_API_BASE_URL=https://expense-manager-udoo.onrender.com/api`, channel `preview`; `production` unused.
- `frontend/app.json` is static; android `package` is `com.navindalmia.expensemanager`, scheme `expensemanager`. A different app id therefore needs a dynamic `app.config.js` (not present today).
- ROADMAP.md:159 "Separate staging and production environments" and the line after it ("migration step ... currently manual") are open/stale. Not re-verified: README "Render watches the repo" claim and PR #90 contents (not on master).

## Assumptions (owner has not answered)

1. Staging DB = a separate Neon branch (or second Neon project) seeded with synthetic data via `prisma/seed.ts`; never a copy of production users.
2. Second Render free web service `expense-manager-staging`. Impact on Render free instance-hours (750h/month is per workspace, so two always-on services may exceed it) is UNKNOWN; owner must check the dashboard before phase 2. Mitigation: staging sleeps when idle (free default), accept cold starts.
3. PR #90 (release notes) merges first and its `scripts/eas-release-notes.js` is reusable; if it changes shape this plan's phase 4 adapts.
4. Owner is the only required reviewer; GitHub free private-repo limitations on branch protection may apply (verify; rulesets on private repos need Pro/Team on some plans).
5. Staging app is Android only; iOS out of scope.

## Branch model

- `master` = production. `staging` = integration/test, long-lived. Feature branches branch from `staging` and PR into `staging`.
- Flow: feature -> PR to `staging` (checks run) -> merge -> auto-deploy staging + staging OTA -> owner tests -> owner opens/approves PR `staging -> master` (merge commit, not squash, so staging stays ancestor and does not diverge) -> production deploy.
- Hotfix: branch from `master`, PR to `master` with owner approval, then back-merge `master` into `staging` immediately.
- Create `staging` from current `master` after PR #90 merges.

### Manual GitHub steps for the owner (exact list)

1. After #90 merges: `git switch master && git pull && git switch -c staging && git push -u origin staging` (or create via GitHub UI).
2. Settings > Branches (or Rulesets) > protect `master`: require a pull request before merging; require 1 approval; "Restrict who can push" / block direct pushes including admins (uncheck bypass); require status checks `backend-test`, `frontend-test`; once phase 3 proves stable also `regression-gate` and `e2e-regression`; require branches up to date; block force pushes and deletions.
3. Add a ruleset/restriction so only `staging` may be the head of PRs into `master` (GitHub has no native head-branch rule; enforce via a small CI check `promotion-source` that fails when `github.base_ref == master && github.head_ref != staging`, added as a required check; hotfix exception handled via label `hotfix` allowed by that check, owner-only).
4. Protect `staging`: require PR, required checks `backend-test`, `frontend-test`; approvals 0 (owner self-merges; avoids blocking); block force pushes and deletion.
5. Settings > Environments: create `staging` (no reviewers) and `production` (required reviewer = owner, deployment branches = `master`). Move deploy secrets into the respective environments.
6. Repo default branch: keep `master` (so PRs default wrong; mitigate with a PR template note "target staging"). Optionally set default to `staging` -- decision for owner (open question 2).
7. Render: create service `expense-manager-staging` (free, rootDir `backend`, same build/start commands, autoDeploy OFF, branch `staging`), set env vars (see secrets). Note service id.
8. Neon: create branch/DB `staging` and copy its connection string.
9. Expo/EAS: no new project needed; verify the same project can hold a second Android application id (it can via variant config, but FCM/credentials: let EAS generate a new keystore for the staging package).
10. Add GitHub secrets (names below).

## CI changes

### ci.yml
- Triggers: `push: branches: [master, staging]`. `pull_request:` stays unfiltered (covers both bases).
- New `deploy-staging` job mirroring `deploy-backend`: `needs: [backend-test, frontend-test]`, `if: github.ref == 'refs/heads/staging' && github.event_name == 'push'`, `environment: staging`, curl to `https://api.render.com/v1/services/${{ secrets.RENDER_STAGING_SERVICE_ID }}/deploys` with `secrets.RENDER_API_KEY`.
- Keep `deploy-backend` as is (master only), add `environment: production`.
- Move the hardcoded production service id (`ci.yml` ~268) to a secret/variable `RENDER_PROD_SERVICE_ID` in a later cleanup PR (not required).
- Add `promotion-source` job (PR into master must come from staging or carry `hotfix` label).
- After deploy, add a smoke step: poll `${STAGING_API_URL}/health` (verify endpoint exists in `backend/src/routes`; if not, hit any public route) up to ~5 min for Render cold start/build, fail the job on timeout so a broken deploy is visible.

### render.yaml
- Add second service `expense-manager-staging` with `NODE_ENV: production` (keeps prod-like behaviour), `REQUIRE_EMAIL_VERIFICATION: "false"`, own `JWT_SECRET`, `APP_SCHEME: expensemanagerstaging://`, `DATABASE_URL` sync:false. Render does not auto-sync render.yaml unless Blueprint is connected; document that dashboard is source of truth.

### EAS
- `frontend/app.json` -> `frontend/app.config.js` reading `process.env.APP_VARIANT`: staging gives `android.package = com.navindalmia.expensemanager.staging`, `name = "Expense Manager (Staging)"`, `scheme = "expensemanagerstaging"`, distinct icon tint if cheap. Default variant output must equal current app.json byte-for-byte in behaviour (snapshot test).
- `frontend/eas.json`: add profile `staging` (`extends` preview-like settings: internal, apk, `channel: "staging"`, env `APP_VARIANT=staging`, `EXPO_PUBLIC_API_BASE_URL=<staging render url>/api`). Leave `preview` untouched = production-pointing live app. Consider renaming preview->production later (out of scope).
- New workflow `.github/workflows/eas-staging.yml`: on push to `staging` with paths `frontend/**`, `.github/workflows/eas-staging.yml`, `scripts/eas-release-notes.js`; jobs `build` (`--profile staging`) and `update` (`eas update --branch staging --message "<release notes headline>"`). Note: deep links in emails (`APP_FRONTEND_URL`/`APP_SCHEME`) must use the staging scheme on the staging backend or verification links open the live app.
- `eas-build.yml` stays master-only. Runtime version policy: confirm `runtimeVersion` so staging OTA does not target the live app (separate channel + separate package makes this safe).
- Ordering gotcha: a native/config change (app id) needs a full APK build once; OTA alone cannot install it.

### Path filters
- Staging EAS only on `frontend/**`. Backend-only staging pushes only run ci.yml deploy-staging. Docs-only pushes: ci still runs (no filter today); acceptable.

## Migrations on staging

- Staging start command keeps `migrate:deploy && seed && start` (same as prod, so staging rehearses exactly what prod will do). That is the point: a migration that fails on staging is caught before master.
- Safety: staging DB is disposable. Recovery = reset the Neon branch (recreate from parent or `prisma migrate reset` run locally against staging URL by the owner). Never run `migrate reset` against prod URL; keep the URLs in separate secrets with distinct names.
- Rule: destructive/non-backward-compatible migrations use expand/contract across two promotions, because the live app (old version) talks to prod DB while new code is tested on staging.
- Seed must be idempotent (verify `prisma/seed.ts` upserts, since it runs on every start) and must not create real-looking credentials; test accounts documented in the release notes/README.
- Optionally add `prisma migrate diff`/`migrate status` check in CI later; not phase 1.
- Roadmap line "Database migration step in deploy pipeline (manual)" is stale since start command runs `migrate:deploy`; fix in docs phase.

## Gates for staging PRs

**Owner decision (2026-10-10): every rule that applies to a master merge today also applies to a merge into `staging`.** Staging mirrors master: the same required checks, the same advisory-vs-required status, the same commit-gate hooks (`.claude/hooks/*`, `.githooks/*`), the same mandatory `/ce-code-review`, regression-test (`issue-<N>`), E2E and visual-baseline rules from CLAUDE.md. Whenever a check on master is promoted to required (e.g. `regression-gate`, `e2e-regression`), it is promoted on `staging` in the same step. The remaining open questions are deferred and will be settled as the work proceeds.

- backend-test, frontend-test: required on PRs into both branches.
- regression-gate (CI): runs on all PRs already; keep advisory until it has a clean record on staging PRs, then make required on both branches (owner step).
- e2e-regression (Playwright vs real Postgres): already per-PR; runs against ephemeral CI services, not staging. No change; staging is for human exploratory testing.
- e2e-mobile / Maestro visual: already per-PR on an emulator; unchanged. Baseline PNGs are app-id independent as long as screens look the same; the staging app name/icon must not appear in screenshots (verify; Maestro CI builds a debug APK of the default variant).
- Post-deploy smoke on staging (above) is the only new automated gate. Promotion PR `staging -> master` re-runs all checks against the merge result.
- Local hooks and `.claude/hooks` unchanged (they gate commits, not branches).

## Release notes

- Reuse `scripts/eas-release-notes.js` from PR #90 (not on master; this plan depends on #90 merging first). Input: commits since last tag/deploy on the branch; output: markdown "What to test" grouped by conventional-commit type (feat/fix), with PR numbers.
- Staging: generated on each push to `staging`, used as the EAS update `--message`, written to the GitHub Actions job summary, and posted to a GitHub Release marked prerelease tagged `staging-YYYYMMDD-<sha7>`.
- Master: on push to master, same script over commits since previous `v*` tag; GitHub Release (non-prerelease) tagged `vYYYY.MM.DD-N`, and EAS update message. Needs `permissions: contents: write` on that job only (ci.yml currently `contents: read` global, so scope per job).
- Testers see them: (a) GitHub Releases page, (b) the EAS update message, (c) optionally an in-app "What's new" is out of scope. The promotion PR body auto-fills with the staging notes since last master release (PR template + script output) so the owner approves with context.
- Fix commits must have summaries a human can read; the script should fall back to the PR title if a commit subject is terse.

## Rollback

- Staging backend: redeploy a previous commit via Render dashboard "Rollback", or revert on `staging` (auto-redeploys). DB: reset Neon staging branch.
- Production backend: Render dashboard rollback to previous deploy (fast, no CI) or revert PR into staging then promote. Migrations are NOT rolled back by a code rollback: hence expand/contract rule.
- Production app: OTA rollback by `eas update:republish` of the previous update to the `preview` branch, or `eas update:rollback`. Native changes need a new APK.
- Staging app: republish previous staging update; uninstalling does not affect the live app (different package).
- Neon free tier has limited point-in-time history (verify window) for prod DB; consider a periodic `pg_dump` before promoting any migration PR (manual owner step, documented).

## Secrets and variables (names only)

Existing: `RENDER_API_KEY`, `EXPO_TOKEN`. New (GitHub, environment-scoped): `RENDER_STAGING_SERVICE_ID`, `STAGING_API_URL`, optionally `RENDER_PROD_SERVICE_ID`. Render staging service env: `DATABASE_URL` (Neon staging), `JWT_SECRET` (distinct from prod), `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (or leave unset so nodemailer/log fallback; avoid emailing real users), `APP_FRONTEND_URL`, `APP_SCHEME`, `NODE_ENV`, `PORT`, `REQUIRE_EMAIL_VERIFICATION`. EAS: `APP_VARIANT` and `EXPO_PUBLIC_API_BASE_URL` set in the eas.json profile (public, not secret). `GITHUB_TOKEN` for releases.

## Cost and limits

- All free: Render free web (spins down after ~15 min idle, cold start ~30-60s, instance-hour pool shared; CHECK), Neon free (storage and compute-hour caps shared across branches in a project; a second project may be safer; CHECK), EAS free tier (limited builds per month; each staging push touching `frontend/**` consumes one build + prod uses one; mitigate: staging build only on `workflow_dispatch` or when native/config files change, otherwise OTA only), GitHub Actions minutes (private repo 2000/month; CI already heavy with emulator e2e; staging pushes add another full CI run on top of the PR run).
- Mitigation for EAS/Actions budget: staging build job conditional on changes to `frontend/app.config.js`, `frontend/package*.json`, `frontend/eas.json`; otherwise OTA only.

## Risks

- Render instance-hours exhausted -> production sleeps/suspends. Highest-impact risk; gate phase 2 on owner check.
- Staging app pointing at prod URL by config mistake (writes test data to prod). Mitigate with a unit test asserting profile -> URL mapping and a visible "STAGING" label in the app.
- Branch divergence (hotfixes, squash merges). Mitigate with merge-commit promotion + back-merge rule.
- Same email deep-link scheme collisions on one device; solved by distinct scheme.
- Branch protection plan limits on private repos; fallback is convention + `promotion-source` check.
- OTA on staging channel pulling updates built for the wrong runtime version.
- `preview` channel naming is confusing (it is the live app); document, rename later.
- Stale docs mislead (README Render claim, ROADMAP migrations).

## Phased delivery (first PR infra-only, no app behaviour change)

0. Prereq: PR #90 merged. Owner decisions on open questions.
1. PR A (infra-only, into master, last direct-to-master change): ci.yml triggers `[master, staging]`, `deploy-staging` job (inert until secret/service exist: guard with `if: ${{ vars.STAGING_ENABLED == 'true' }}`), `promotion-source` job (non-required initially), `environment:` keys, render.yaml staging service block, PR template. No frontend/backend source change; app.json untouched. Verify by workflow lint and a dry run on a throwaway branch.
2. Owner manual steps 1-10 above (create staging branch, Render service, Neon DB, secrets, set `STAGING_ENABLED`). First staging deploy by merging a no-op into staging; confirm smoke passes and migrations apply on the empty DB.
3. PR B (into staging): `app.config.js` variant + `eas.json` `staging` profile + `eas-staging.yml`; tests for variant config. First staging APK built via `workflow_dispatch`; install beside live app and verify.
4. PR C (into staging): release-notes wiring for staging and master (GitHub Releases, job summary, PR body), tag scheme.
5. Owner turns on branch protection for master (the "nothing direct" switch), required checks including `promotion-source`; promote B/C via first `staging -> master` PR as the end-to-end rehearsal.
6. PR D: docs cleanup (README deploy flow, ROADMAP lines, a `docs/solutions/` entry via ce-compound, update `CLAUDE.md` workflow section and `PROJECT_MEMORY/01-MASTER_STATE.md`).

## Test strategy

- Config tests (vitest): `app.config.js` returns production values by default and staging package/scheme/name under `APP_VARIANT=staging`; `eas.json` staging profile points to staging URL, never the production URL; preview profile unchanged.
- Workflow checks: `actionlint` on new workflows; throwaway-branch dry run for trigger/`if` conditions; `promotion-source` tested with a feature-branch PR (should fail) and a staging PR (should pass).
- Release-notes script: unit tests with fixture commit logs (existing script tests from #90 extended for tag-range and fallback).
- Smoke: post-deploy health poll; manual checklist on the staging APK (login, create expense, deep link verify email opens the staging app, live app unaffected).
- Migration rehearsal: PR with a schema change must be seen deployed on staging before promotion.
- Per repo rules, fix-type commits still need regression files; infra PRs use `Regression-Exempt:`/`Test-Exempt:` trailers with reason as appropriate.

## Open questions for the owner

1. Render free instance-hours: does a second always-on service fit your workspace quota? (blocks phase 2)
2. Make `staging` the GitHub default branch so PRs target it by default?
3. Neon: new branch in the existing project (shares free caps) or a second project?
4. Should staging send real email (SendGrid) or log-only/nodemailer?
5. Is GitHub plan sufficient for enforced branch protection on a private repo; if not, accept convention + `promotion-source` check?
6. Staging approvals: self-merge into `staging` with no reviewer, or require approval there too?
7. Merge-commit vs squash for `staging -> master` (plan recommends merge commit)?
8. EAS build budget: OK with staging APK built only on native/config change or manual dispatch?
9. Make `regression-gate` and `e2e-regression` required once stable?
10. Rename `preview` EAS profile/channel to `production` for clarity later?
