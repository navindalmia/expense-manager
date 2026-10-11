# Staging environment: owner setup guide

Owner decision: every rule that applies to a merge into `master` applies to `staging` too (same required checks, same hooks, same mandatory `/ce-code-review`, regression, E2E and visual-baseline rules).

Everything in the repo is **inert** until you set the repo variable `STAGING_ENABLED=true`. Merging the code changes nothing for production.

## Read before enabling

- **Red check warning:** until the `staging` branch exists and the `hotfix` label is created, every PR into `master` shows a red `promotion-source` check. Make it a *required* check only after the first successful `staging -> master` promotion rehearsal.
- **Protect `staging` BEFORE setting `STAGING_ENABLED`:** `deploy-staging` runs on any push to `staging` once enabled, so unprotected `staging` means anyone with push access can deploy to the staging backend without review (step 3 before step 8).
- **`promotion-source` trust model:** it runs on `pull_request_target` from the base branch (PR code is never executed), rejects fork PRs, and `.github/` plus `scripts/promotion-source.js` are CODEOWNERS-protected (`@navindalmia`). For that to bind, **master's protection must require a PR with approval AND "Require review from Code Owners"**.
- **`hotfix` label is a convention, not an enforced control.** Anyone with triage access can add it, and a workflow cannot tell who did. The real safeguard is the required owner approval on every PR into `master`. No actor check is attempted (simplest honest option).
- **Render Blueprint:** if a Blueprint is connected to this repo with auto-sync, merging `render.yaml` WILL make Render try to create the staging service. Either leave the Blueprint unsynced, or create the service by hand first (step 6).
- **Android versionCode:** `eas.json` `autoIncrement` is not used because it cannot write to the dynamic `app.config.js`; the staging variant derives an increasing `versionCode` instead (override with `STAGING_VERSION_CODE`).
- **Placeholder guard:** the staging APK build and OTA jobs fail while `EXPO_PUBLIC_API_BASE_URL` still contains `REPLACE-` (`scripts/check-staging-config.js`).

## Flow

feature branch -> PR into `staging` -> auto-deploy staging backend + OTA to the staging app -> you test -> PR `staging` -> `master` (merge commit, not squash) -> production deploy. Hotfix: branch from `master`, PR to `master` with the `hotfix` label, then back-merge `master` into `staging`.

## Owner manual steps (in order)

1. **Check Render quota first.** Free instance hours are per workspace; a second always-on service may exhaust them and suspend production. Check the Render dashboard before step 5.
2. **Create the branch** (after the staging PR is merged): `git switch master && git pull && git switch -c staging && git push -u origin staging`.
3. **Branch protection / rulesets** (Settings > Branches). Copy master's *current* rules onto `staging` exactly (whatever Settings shows for master today), including required checks `backend-test` and `frontend-test`. Then for `master`: require a PR, require approval, no bypass for admins, block force pushes and deletions, require `promotion-source` as a check. When `regression-gate` / `e2e-regression` are promoted to required on master, promote them on `staging` in the same step. Private-repo plan limits may apply; if rules cannot be enforced, the `promotion-source` check plus convention is the fallback.
4. **Environments** (Settings > Environments): create `staging` (no reviewers) and `production` (required reviewer = you, deployment branch = `master`). Optional: move deploy secrets into them (the workflows here read repo-level secrets and will keep working).
5. **Neon**: create a separate project (safer for free caps) or a branch for staging; copy its connection string. It must never be the production URL.
6. **Render**: create web service `expense-manager-staging` by hand (or connect a Blueprint) matching the `expense-manager-staging` block in `render.yaml`: free plan, root dir `backend`, branch `staging`, **Auto-Deploy off**, build `npm install --include=dev && npm run build`, start `npm run migrate:deploy && npm run seed && npm start`. Env vars: `DATABASE_URL` (Neon staging), `JWT_SECRET` (different from prod), `JWT_EXPIRES_IN=24h`, `APP_FRONTEND_URL`, `APP_SCHEME=expensemanagerstaging://`, `APP_NAME`, `NODE_ENV=production`, `PORT=4000`, `REQUIRE_EMAIL_VERIFICATION=false`. Leave SendGrid vars **unset** so email stays log-only. Note the service id (`srv-...`) and the URL.
7. **GitHub secrets** (Settings > Secrets and variables > Actions): `RENDER_STAGING_API_KEY`, `RENDER_STAGING_SERVICE_ID`. Existing `EXPO_TOKEN` is reused.
8. **GitHub variables**: `STAGING_API_URL` (e.g. `https://<staging-host>.onrender.com/api`, with `/api`), then `STAGING_ENABLED=true` **last**.
9. **EAS**: edit `frontend/eas.json` profile `staging`, replacing the placeholder `EXPO_PUBLIC_API_BASE_URL` (`https://REPLACE-WITH-STAGING-RENDER-HOST.onrender.com/api`) with the staging URL (JSON has no comments; this placeholder is the only owner-supplied value). Let EAS generate a new keystore for the `.staging` package on the first build.
10. **First enable**: merge a no-op into `staging`; confirm `deploy-staging` passes its health smoke (`GET /` on the host root, expecting 200 and `Expense Manager API running`) and migrations applied on the empty DB. Run `EAS Staging (Android)` via *Run workflow* to build the first APK; install it beside the live app and verify login, create expense, and that a verification deep link opens the staging app only.
11. Add the `hotfix` label (Issues > Labels) for the exception path. Optionally make `staging` the default branch (open question 2).

## Migrations and backups

Staging runs `migrate:deploy && seed && start`, the same as production, to rehearse migrations. `prisma/seed.ts` is idempotent (upserts currencies/categories only) and seeds no users, so it holds no real or real-looking data. Before promoting a PR that contains a migration, take a `pg_dump` of the production Neon DB (manual). Use expand/contract for destructive changes, since the live app keeps talking to the production DB while new code is tested on staging. A code rollback does not roll back migrations.

## Rollback

- Staging backend: Render dashboard rollback, or revert on `staging`. DB: reset/recreate the Neon staging DB.
- Production backend: Render dashboard rollback to the previous deploy.
- Staging app: `eas update:republish` the previous update on branch `staging`; uninstalling does not affect the live app (different package).
- Never run `prisma migrate reset` against the production URL.

## Notes

- The smoke job polls the host root (`STAGING_API_URL` minus `/api`, via `scripts/staging-health-url.js`). `/api/internal/*` is only mounted when `NODE_ENV !== 'production'`, so it is a 404 on staging.
- The prerelease GitHub Release (`staging-YYYYMMDD-<sha7>`) and job summary use `node scripts/eas-release-notes.js --list <before> <head>`. Promotion PRs use `.github/PULL_REQUEST_TEMPLATE/promotion.md` (append `?template=promotion.md` to the compare URL).
- The master-side release (`vYYYY.MM.DD-N` GitHub Release) from the plan's phase 4 is not implemented here.
