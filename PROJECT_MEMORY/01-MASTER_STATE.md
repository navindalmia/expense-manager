# Expense Manager — Current State

> Status summary only, updated at feature boundaries — not a session log. For scope, phases, and open work items, see [`ROADMAP.md`](../ROADMAP.md) in repo root. For historical problem/fix investigations, see `docs/solutions/`. For git history, use `git log`. See [`MIGRATIONS.md`](./MIGRATIONS.md) for why this file's role changed.

## Snapshot

**Version:** v0.4.0-beta — auth, groups, expense CRUD, splits, settlement all stable end-to-end on mobile. Live deployment: Render (backend) + Neon (Postgres) + EAS (mobile builds), since 2026-08-01. No web deployment target yet.

**CI/CD:** real GitHub Actions CI is live on `master` — `backend-test`/`frontend-test` required checks, `deploy-backend` gated on both passing. `e2e-mobile` (Maestro, Android emulator, 3 flows: login/group-list/expense-list) is live and running, not disabled — confirmed 2026-09-14 by reading `ci.yml` directly (an earlier version of this file wrongly said it was hard-disabled; that was stale as of 2026-09-02's PR #29).

**Known broken (low priority):** web email-verification deep link (`/verify-email?token=...` falls back silently to Login) — only matters if `REQUIRE_EMAIL_VERIFICATION` is ever `true` in production; it's `false` live, so this doesn't block real users. See ROADMAP Phase 4/5d.

**In progress, not yet merged:** `feat/intelligence-layer-themes-labels-autocomplete` branch — Themes, user-extensible Categories, cross-group Labels + Manage Labels screen, expense-title autocomplete, keyword-dictionary category suggestion. All 10 implementation units done, backend (413 tests) + frontend (157 tests) unit suites green, `tsc` clean both sides, and — as of 2026-09-14 — genuinely verified with a real Playwright E2E test against a live backend+Postgres+rendered web app (not just mocks), run 3x clean. Not yet wired into CI, no PR opened yet. See ROADMAP's Phase 8 entry for full detail and the two items still open (CI wiring, a flagged `fuzzyMatch.ts` matching-quality question for Navin).

Full list of open gaps, bugs, and planned phases: [`ROADMAP.md`](../ROADMAP.md).

## Where things live

| Need | Read |
|------|------|
| Current scope, phases, open bugs | [`ROADMAP.md`](../ROADMAP.md) (repo root) |
| Split-array indexing convention | [`07-SPLIT_ARRAY_ARCHITECTURE.md`](./07-SPLIT_ARRAY_ARCHITECTURE.md) |
| Coding patterns (DB, API, frontend) | [`03-CODING_PATTERNS.md`](./03-CODING_PATTERNS.md) |
| Testing approach & coverage goals | [`04-TESTING_STRATEGY.md`](./04-TESTING_STRATEGY.md) |
| Code review / quality gate checklist | [`05-QUALITY_STANDARDS.md`](./05-QUALITY_STANDARDS.md) |
| EditExpenseScreen UI design reference | [`09-EDITEXPENSESCREEN_DESIGN_DOCUMENTATION.md`](./09-EDITEXPENSESCREEN_DESIGN_DOCUMENTATION.md) |
| Agreed AI/agent collaboration patterns | [`10-AI_COLLABORATION.md`](./10-AI_COLLABORATION.md) |
| Past problem investigations & fixes | `docs/solutions/` (repo root) |
