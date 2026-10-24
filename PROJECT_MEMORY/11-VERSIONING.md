# 11 — App versioning

The app version (`version` in `frontend/app.config.js`, mirrored in `frontend/package.json`) is the release label users and testers see on the About screen. It is **separate from the build number**, which EAS bumps on every build.

## Rule (starts with the next release; today master is 1.0.0)

Semantic versioning, `MAJOR.MINOR.PATCH`:

- **PATCH** (1.0.1): bug fixes only, nothing new visible.
- **MINOR** (1.1.0): a new feature that breaks nothing existing.
- **MAJOR** (2.0.0): a breaking change (redesign, forced re-login, data loss risk).
- Several changes in one release: the biggest one decides the bump.

## When

Everything reaches master through `staging`, so the version is bumped in each PR **into `staging`** that changes app code (`frontend/src` or `backend/src`, excluding `__tests__`): `feat` -> MINOR, `fix` -> PATCH, breaking -> MAJOR. Docs-, CI- and test-only PRs do not bump. Promotion PRs (`staging` -> `master`) carry the already-bumped version; hotfixes into master bump PATCH. If two open PRs bump from the same base, the second to merge rebases and re-bumps above the first.

## Mechanics

- Change `version` in `frontend/app.config.js` and `frontend/package.json` to the same value.
- `.github/workflows/version-guard.yml` runs `scripts/version-guard.js` on every PR into staging or master and, when app code changed, fails if the version is not strictly above the base branch's, malformed, or out of sync with `package.json`. Tests: `scripts/__tests__/version-guard.test.js` (part of `npm run test:gate`).
- Tag the merge commit `v<version>` after promotion.
- The version does not affect how testers install builds (manual EAS links); check the build number on About to tell builds apart.
