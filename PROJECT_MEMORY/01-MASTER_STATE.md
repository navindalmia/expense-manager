# Expense Manager — Current State

> Status summary only, updated at feature boundaries — not a session log. For scope, phases, and open work items, see [`ROADMAP.md`](../ROADMAP.md) in repo root. For historical problem/fix investigations, see `docs/solutions/`. For git history, use `git log`. See [`MIGRATIONS.md`](./MIGRATIONS.md) for why this file's role changed.

## Snapshot

**Version:** v0.4.0-beta — auth, groups, expense CRUD, splits, settlement all stable end-to-end on mobile. Live deployment: Render (backend) + Neon (Postgres) + EAS (mobile builds), since 2026-08-01. No web deployment target yet.

**CI/CD:** real GitHub Actions CI is live on `master` — `backend-test`/`frontend-test` required checks, `deploy-backend` gated on both passing. `e2e-mobile` (Maestro, Android emulator, 3 flows: login/group-list/expense-list) is live and running, not disabled — confirmed 2026-09-14 by reading `ci.yml` directly (an earlier version of this file wrongly said it was hard-disabled; that was stale as of 2026-09-02's PR #29).

**Known broken (low priority):** web email-verification deep link (`/verify-email?token=...` falls back silently to Login) — only matters if `REQUIRE_EMAIL_VERIFICATION` is ever `true` in production; it's `false` live, so this doesn't block real users. See ROADMAP Phase 4/5d.

**Merged 2026-09-18 (PR #55, `bfe1cc9`):** intelligence layer — Themes, user-extensible Categories, cross-group Labels + Manage Labels screen, expense-title autocomplete, keyword-dictionary category suggestion. Verified with a real Playwright E2E against live backend+Postgres+web app before merge. Still unconfirmed whether the `fuzzyMatch.ts` matching-quality question (stopwords like "to"/"the" score nonzero, no minimum threshold) was ever decided — check before assuming it's resolved.

**Also merged 2026-09-24:** PR #71 (SessionStart stale-check hook + usage-quota gate).

**Regression pack + CI gate (merged 2026-09-23/24, PR #74 and follow-ups #72/#73/#75/#76/#77/#78/#79/#80/#81):** `regression-gate` and `e2e-regression` CI jobs, static `.githooks/*`, 8 Maestro visual baselines. **Owner action pending:** mark `regression-gate` + `e2e-regression` (not `e2e-mobile`, still flaky) as required checks in `master` branch protection.

**Open, needs attention:**
- **Issue #45** (Paid-by 2nd+ member unselectable) — root-caused as RN `Modal` not inheriting `SafeAreaView` bottom insets (Android 3-button nav bar covers rows). Fix is PR #82 with a behavioral regression test and a Maestro baseline, emulator-verified but not yet on a physical device.
- **PR #82** (the #45 fix, open) — reviewed with `/ce-code-review` (Ready with fixes, fix applied); all CI green except `e2e-mobile`. Awaiting the owner's decision to merge.
- **`e2e-mobile` CI job** — failing on every master run since ~2026-09-17 (8 of 9 Maestro flows fail at login: `submit-button`/`email-input` not found). Not caused by #82; under investigation.
- Issues #47, #48, #5 — not started, need `/ce-brainstorm`/`/ce-plan` scoping first.
- Many older open PRs (#60/#61/#63/#64/#65/#67/#69 plus Dependabot bumps) predate the 09-23 merge batch and show CI failures — triage for staleness/duplicates (#66 was already closed as a duplicate of #76).

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
