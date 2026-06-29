# AI Collaboration Patterns & Lessons Learned

Living document. Updated as we discover what works.

---

## Agreed Workflow Patterns (June 2026)

### Parallel Subagents
Backend and frontend are independent — use parallel agents for unrelated tasks. Don't run them sequentially when there's no dependency.

```
Example:
  Agent A → fix 48 failing backend tests
  Agent B → map all routes missing auth checks
  → both run simultaneously, results merged
```

### Agentic Loop for Test-Fix Cycles
For failing test suites: run loop (execute → read failures → fix → repeat) until green. No per-iteration check-ins. Report result at end. Use this for the 48 failing tests.

### Code Review via `/code-review`
Matches existing Code→Review→Test→Commit workflow:
- `/code-review` — standard, for bug fixes
- `/code-review ultra` — deep multi-agent, for new features and refactors

### Explore Subagent Before Large Refactors
Before touching split data model, auth middleware, or any cross-cutting concern — spawn Explore agent first to map all call sites and side effects. Prevents blind spots.

### Scheduled Agents
Option to schedule daily agent for: run tests → check git status → update MASTER_STATE → report. Not yet configured but agreed as useful.

---

## How We Grow the Codebase Together

**Navin decides:** product priorities, UX choices, architectural tradeoffs, what goes to production  
**Claude does:** implementation, testing, code review, refactoring, documentation, parallel workstreams  
**Both:** design decisions discussed before implementation, not after

**Checkpoints:**
- Start of significant work: agree on approach first (plan mode)
- End of significant work: `/code-review` before commit
- Each session: read `01-MASTER_STATE.md` to pick up where we left off

---

## Lessons Learned

| Date | Lesson |
|------|--------|
| June 2026 | Always verify claims from code before asserting — Navin will catch it (split model array design was intentional, not a bug) |
| June 2026 | `backend/roadmap.md` was wrong location — project-level docs belong at repo root |
| June 2026 | No root `README.md` existed — standard industry expectation, created immediately |
| June 2026 | `MASTER_STATE.md` had dual version headers from accumulated drift — keep it clean, single source of truth |
| June 2026 | Claude skills live in AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache (not AppData\Roaming) — the Roaming path is a junction |
| June 2026 | manifest.json symlink didn't take via admin PS — copy it instead; post-commit hook handles ongoing sync |
| June 2026 | `/checkpoint` conflicts with a Claude built-in CLI command — user-created skills must avoid built-in names |
| June 2026 | User-created skills not appearing in skill list after manifest update — requires full Claude app restart and may need further investigation into how user skills register vs Anthropic skills |
| June 2026 | Dev Container setup: `.devcontainer/` added with devcontainer.json, docker-compose.dev.yml, post-create.sh — new laptop setup is now: install VS Code + Docker Desktop, clone repo, copy .env files, click "Reopen in Container" |
| June 2026 | DATABASE_URL must use `postgres` hostname (not `localhost`) inside Docker containers — overridden in docker-compose.dev.yml env section |
| June 2026 | Shell scripts committed from Windows get CRLF line endings and break in Linux containers — fixed via .gitattributes forcing LF for .devcontainer/*.sh |
| June 2026 | Code review is mandatory before every commit per WORKFLOW.md — was skipped on devcontainer commit, caught two bugs (hardcoded credentials, CRLF line endings) |

---

## What Claude Handles Autonomously (No Check-in Needed)

- Running and re-running tests until passing
- TypeScript checks (`npx tsc --noEmit`)
- Restarting servers (`taskkill /F /IM node.exe` then restart)
- Reading project memory files at session start
- Updating `MASTER_STATE.md` after phase completions

## What Always Needs Navin's Approval

- Committing to git
- Pushing to origin
- Dropping database tables or destructive migrations
- Any change to production configuration
- Architectural decisions (new patterns, new dependencies)
