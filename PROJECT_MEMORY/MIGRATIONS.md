# Workflow & Tooling Migrations

Log of major changes to how this repo's development process works, and why. Append new entries at the top.

---

## 2026-07-21 — Merged review checklist into CLAUDE.md for `/ce-code-review`

**Why:** CE has no separate config format for review criteria — `.compound-engineering/config.local.yaml` is machine-local settings only. CE agents read `CLAUDE.md` for project-specific rules and context, and there's no guarantee `/ce-code-review` follows a markdown link out to a separate file rather than working only from what's directly in `CLAUDE.md`. The OWASP/SOLID/quality checklist previously only linked from `CLAUDE.md` → `PROJECT_MEMORY/05-QUALITY_STANDARDS.md` risked being invisible to the review stage.

**What changed:**
- Added a condensed "Code Review Standards" section directly in `CLAUDE.md` (security/quality/testing FAIL criteria + verdict format) — this is what `/ce-code-review` actually applies
- `PROJECT_MEMORY/05-QUALITY_STANDARDS.md` kept as the detailed reference (test naming examples, API/DB/frontend standards) and now points back at `CLAUDE.md` as the source of truth — **keep both in sync when either changes**

**Also confirmed:** CE does not currently enforce `/ce-code-review` as a hard gate before commit — that enforcement (blocking `git commit` until review + tsc pass) still comes from the `.claude/settings.json` `PreToolUse` hook, not from CE itself. Native CE hook-based enforcement is in progress upstream (not yet shipped) — revisit whether the local hook is still needed once that lands.

---

## 2026-07-21 — Adopted Compound Engineering plugin, removed custom workflow/agent system

**Why:** The repo had a hand-rolled 4-phase workflow (`WORKFLOW.md`) plus 4 custom agent definitions (`AGENTS.md`, `.agents/*.agent.md`, `.agent.md` router) that duplicated what the [Compound Engineering plugin](https://github.com/EveryInc/compound-engineering-plugin) provides out of the box (`/ce-plan` → `/ce-work` → `/ce-code-review` → `/ce-compound`), plus a 51-agent library. Running both would have caused conflicts — both systems wanted to own `CLAUDE.md` as the source of truth for agent behavior. The custom system was also immature (no learning-capture step, ad-hoc 10-minute memory updates) compared to CE's built-in `docs/solutions/` institutional memory.

**What was removed:**
- `WORKFLOW.md` — 4-phase process definition → replaced by CE's plan/work/review/compound stages
- `AGENTS.md` — agent role directory → replaced by CE's built-in agent library
- `.agent.md` — main agent router → replaced by CE's orchestration
- `.agents/implementer.agent.md`, `.agents/reviewer.agent.md`, `.agents/tester.agent.md`, `.agents/planner.agent.md` — custom role definitions → superseded by CE agents
- `PROJECT_MEMORY/02-WORKFLOW.md` — literal duplicate of `WORKFLOW.md`, removed independent of the CE decision

**What was kept (no overlap with CE):**
- `PROJECT_MEMORY/03-CODING_PATTERNS.md`, `04-TESTING_STRATEGY.md`, `05-QUALITY_STANDARDS.md` — project-specific content, now feed into CE's `/ce-code-review` as reference material rather than being read by a custom Reviewer agent
- `.instructions.md` — coding standards, updated to point at CE stages instead of `WORKFLOW.md`/`.agent.md`
- `PROJECT_MEMORY/01-MASTER_STATE.md` — role changed from a 10-minute rolling log to a human-curated status summary updated at feature boundaries; per-problem memory now lives in `docs/solutions/` (CE's `/ce-compound` output), which lives in the repo so it travels across machines

**Also fixed in passing:** `.claude/settings.json` hooks were hardcoded to `"shell": "powershell"` despite this repo being worked on cross-platform (Windows + macOS); removed the hardcoded shell so hooks run under whatever shell is native to the machine. Hook language updated to reference `/ce-code-review` instead of the old `code-review` Skill invocation.

**Still pending (requires interactive terminal, not scriptable):**
```
/plugin marketplace add EveryInc/compound-engineering-plugin
/plugin install compound-engineering
```
Until this is run, `CLAUDE.md`'s workflow section describes a pipeline that isn't installed yet.
