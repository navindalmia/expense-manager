# PROJECT_MEMORY — Navigation

Persistent, git-tracked project context. `01-MASTER_STATE.md` is a short current-state snapshot, not a session log — it points to `ROADMAP.md` (repo root) for scope/open work and to `docs/solutions/` (repo root) for historical problem investigations.

## By purpose

| Need | Read |
|------|------|
| Current version, what's stable/broken | [`01-MASTER_STATE.md`](./01-MASTER_STATE.md) |
| Project scope, phases, open bugs/gaps | [`ROADMAP.md`](../ROADMAP.md) (repo root) |
| Development workflow (plan → work → review → compound) | root `CLAUDE.md` — Compound Engineering plugin stages |
| Coding patterns (DB, API, TypeScript) | [`03-CODING_PATTERNS.md`](./03-CODING_PATTERNS.md) |
| Testing approach & coverage goals | [`04-TESTING_STRATEGY.md`](./04-TESTING_STRATEGY.md) |
| Code review / quality gate checklist | [`05-QUALITY_STANDARDS.md`](./05-QUALITY_STANDARDS.md) |
| Split-array indexing convention | [`07-SPLIT_ARRAY_ARCHITECTURE.md`](./07-SPLIT_ARRAY_ARCHITECTURE.md) |
| EditExpenseScreen UI design reference | [`09-EDITEXPENSESCREEN_DESIGN_DOCUMENTATION.md`](./09-EDITEXPENSESCREEN_DESIGN_DOCUMENTATION.md) |
| Agreed AI/agent collaboration patterns | [`10-AI_COLLABORATION.md`](./10-AI_COLLABORATION.md) |
| Why the memory/workflow system changed | [`MIGRATIONS.md`](./MIGRATIONS.md) |
| Past problem investigations & fixes | `docs/solutions/` (repo root) |

## File structure

| File | Purpose |
|------|---------|
| **01-MASTER_STATE.md** | Current version, what's stable, what's broken |
| **03-CODING_PATTERNS.md** | Database, API, TypeScript patterns |
| **04-TESTING_STRATEGY.md** | Testing approach, checklist, coverage goals |
| **05-QUALITY_STANDARDS.md** | SOLID, security, code review gates |
| **07-SPLIT_ARRAY_ARCHITECTURE.md** | Split array storage/indexing convention |
| **09-EDITEXPENSESCREEN_DESIGN_DOCUMENTATION.md** | EditExpenseScreen UI design reference |
| **10-AI_COLLABORATION.md** | Agreed AI/agent collaboration patterns |
| **MIGRATIONS.md** | Log of major workflow/tooling changes and why |
| **README.md** | This file |

## How to keep this current

Update `01-MASTER_STATE.md` at feature boundaries, not continuously — it should stay short. Open bugs/gaps live in `ROADMAP.md`; problem-solving history goes to `docs/solutions/` via the `/ce-compound` stage. Don't let session-by-session logs accumulate back into these files — that's the pattern this cleanup removed.
