# Expense Manager — Current State

> Status summary only, updated at feature boundaries — not a session log. For scope, phases, and open work items, see [`ROADMAP.md`](../ROADMAP.md) in repo root. For historical problem/fix investigations, see `docs/solutions/`. For git history, use `git log`. See [`MIGRATIONS.md`](./MIGRATIONS.md) for why this file's role changed.

## Snapshot

**Version:** v0.4.0-beta — not yet production-deployed.

**Stable and working end-to-end (mobile, Expo Go):** auth, groups, expense CRUD, splits (EQUAL/AMOUNT/PERCENTAGE), settlement summaries.

**Known broken (low priority):** web email-verification deep link (`/verify-email?token=...` falls back silently to Login instead of verifying) — only matters if `REQUIRE_EMAIL_VERIFICATION` is ever set `true` in production; signup/login already skip verification cleanly when it's `false` (fixed 2026-08-16, commit `421c575`). See ROADMAP Phase 4/5d.

**Test suites:** priority coverage (authorization, security middleware, key screens) merged long ago (PR #1). Real CI is live on `master` (GitHub Actions, `backend-test`/`frontend-test` required checks, branch protection enforced) since 2026-08-22.

**⚠️ PRIORITY, blocks new feature work (set 2026-08-31): finish `docs/plans/2026-08-22-001-feat-ci-visual-regression-a11y-gates-plan.md` (U3–U6) before starting anything else.** PR #9 for this plan merged 2026-08-31, but the merge only closed the PR — it did **not** mean the plan's units were done; U1/U2/U7 are complete, U3 (Maestro flow repair) is partial and never verified end-to-end against a real Android build, and **U4 (visual-regression baselines), U5 (accessibility assertions), and U6 (wiring Maestro into CI as an enforced gate) were never started at all** — `ci.yml`'s `e2e-mobile` job is still hard-disabled (`if: false`). Explicit user instruction: complete this plan before picking up any new feature (including the intelligence-layer plan below). Do not treat "PR merged" as "plan done" again — check the plan's own unit list, not just PR/merge state.

**Next candidate work (parked until the above is done):** `docs/plans/2026-08-31-001-feat-intelligence-layer-themes-labels-autocomplete-plan.md` — requirements-only, not yet planned/implemented. Themes, extensible Categories, cross-group Labels, expense-title autocomplete, keyword-based category auto-suggestion. Explicitly infra-first; a settlement/KPI dashboard and NL expense Q&A (Phase 8) are deferred future consumers of this, not built here.

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
