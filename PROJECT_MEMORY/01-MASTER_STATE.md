# Expense Manager — Current State

> Status summary only, updated at feature boundaries — not a session log. For scope, phases, and open work items, see [`ROADMAP.md`](../ROADMAP.md) in repo root. For historical problem/fix investigations, see `docs/solutions/`. For git history, use `git log`. See [`MIGRATIONS.md`](./MIGRATIONS.md) for why this file's role changed.

## Snapshot

**Version:** v0.4.0-beta — not yet production-deployed.

**Stable and working end-to-end (mobile, Expo Go):** auth, groups, expense CRUD, splits (EQUAL/AMOUNT/PERCENTAGE), settlement summaries.

**Known broken:** web email-verification link (`/verify-email?token=...` falls back silently to Login instead of verifying) — see ROADMAP Phase 4/5d.

**Test suites:** drift fixed and priority coverage added (authorization, security middleware, key screens) in PR [#1](https://github.com/navindalmia/expense-manager/pull/1) (`test/baseline-and-priority-coverage`), **not yet merged to master**. No CI configured on this repo — check current run before relying on a number once merged.

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
