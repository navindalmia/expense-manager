# Workflow & Tooling Migrations

Log of major changes to how this repo's development process works, and why. Append new entries at the top.

---

## 2026-07-21 — Made the commit-hook gate repo-aware

**Why:** The hook is registered in expense-manager's `.claude/settings.json`, but its matcher (`"Bash(git commit*)"`) only inspects command text, not which repo it targets — a command like `git -C /some/other/repo commit` still matches. The first version of `pre-commit-gate.js` always checked `expense-manager/backend`'s TypeScript regardless of which repo was actually being committed to. It happened not to cause a visible problem yet only because it was never triggered by a matching command against another repo in practice — but that was luck, not correctness, and confirmed by direct testing (see below) that it needed fixing.

**What changed:** The script now reads the hook's stdin JSON payload, extracts the actual target directory (parses `-C <path>` out of the command if present, else falls back to cwd), resolves that to a real git repo root, and shallow-scans that repo for `tsconfig.json` files. If none exist — e.g. the `-claude-memory` repo, which has no TypeScript — the check is skipped entirely rather than running expense-manager's `tsc` against an unrelated commit. If TypeScript projects are found, each is checked independently.

**Verified with 4 direct tests** (stdin JSON simulated exactly as the harness sends it): (1) plain commit in expense-manager with clean tsc → passes; (2) `git -C` targeting the memory repo → skips, no tsconfig found; (3) plain commit in expense-manager with a deliberately broken tsc → blocks with real error, exit 2; (4) `git -C` targeting the memory repo *while expense-manager's tsc is simultaneously broken* → still skips, confirming the fix actually works and isn't just theoretically better.

---

## 2026-07-21 — Restored deterministic commit-hook gate (regression from Jul 8 fix)

**Why:** While saving session memory, discovered the `git commit` PreToolUse hook was running the exact broken mechanism a July 8 commit (`d0f4e43`) had already fixed and documented as fixed: a `type: "prompt"` hook that asks the LLM to check the conversation transcript for evidence tsc/review ran. That fix replaced it with a deterministic `type: "command"` hook calling a PowerShell script. Root cause of the regression: a later commit (`2e7bfff`, Jul 19) branched from the pre-fix state (matching commit hash `cc916e3`) and reintroduced the prompt-based hook while only fixing its matcher scoping — the PowerShell-script version and `d0f4e43`'s fix never made it onto the branch line later commits (including this session's) were built on. No `.claude/hooks/pre-commit-gate.ps1` existed anywhere in current history.

**What changed:** Added `.claude/hooks/pre-commit-gate.js` — a deterministic, cross-platform (plain Node, no shell script) replacement. Runs `backend/node_modules/typescript/bin/tsc --noEmit` directly via `spawnSync`, using `$CLAUDE_PROJECT_DIR` for path resolution instead of a hardcoded machine path (the original PowerShell version hardcoded `C:\nd\repos\expense-manager\...`, which is part of why it likely didn't survive a cross-machine merge). Fails open (allows the commit) if `backend/node_modules/typescript` is missing, so a broken dev environment can't block every commit the way the original broken hook did. Tested both paths directly before wiring in: passes cleanly against the current codebase, blocks with the real `tsc` error text (exit code 2) when a type error is deliberately introduced.

**Deliberately out of scope (same as the Jul 8 design):** only `tsc` is gated deterministically. `/ce-code-review` and the full test suite remain PostToolUse *reminders*, not hard gates — code review is an agent action with no disk-checkable trace, and the full suite is too slow to run on every commit attempt.

---

## 2026-07-21 — Replaced fixed 50-line function rule with single-responsibility principle

**Why:** Neither Google's nor Airbnb's JS/TS style guides specify a hard line-count limit for functions — Airbnb's stated principle is "if a function is large/complex enough to interfere with understanding the file, extract it," a readability judgment, not a number. Our "<50 lines" rule was an arbitrary figure this project picked, never checked against a real standard. Since CE's `project-standards-reviewer` now treats `CLAUDE.md` rules as literal, binding criteria, it was worth being intentional rather than mechanically enforcing an arbitrary threshold.

**Decision (user's call, 3 options offered):** keep the number as-is / keep it but soften to a guideline / drop the number and state the underlying principle. Chose the third: drop the fixed count, keep the principle ("extract when a function does more than one thing or its size interferes with understanding the file").

**What changed:** Updated all four places this rule appeared — `CLAUDE.md` (Coding Rules + Code Review Standards), `.instructions.md`, `PROJECT_MEMORY/05-QUALITY_STANDARDS.md`, `PROJECT_MEMORY/03-CODING_PATTERNS.md` — so `/ce-code-review`'s project-standards persona won't cite conflicting versions of the same rule.

---

## 2026-07-21 — Benchmarked security checklist against OWASP Top 10:2025 and CE's built-in security-reviewer

**Why:** Our security checklist in `CLAUDE.md` was hand-derived over months and never checked against an actual standard, nor against what CE's own `security-reviewer` persona already does automatically.

**Findings:**
- OWASP Top 10:2025 (current, supersedes 2021) added two categories we had zero coverage for: **A03 Software Supply Chain Failures** (now top-3, was a sub-part of 2021's A06) and **A10 Mishandling of Exceptional Conditions** (new). **A02 Security Misconfiguration** also jumped from #5 to #2 — also uncovered.
- CE's `security-reviewer` persona (read directly from its source) already hunts, at high confidence, for: injection (SQL/XSS/shell), auth/authz bypass, hardcoded secrets, secrets in logs, SSRF, path traversal, insecure deserialization. Restating these in `CLAUDE.md` is redundant — CE finds them without needing a project-standards citation.
- CE's docs explicitly list "consider adding rate limiting" as generic hardening advice it deliberately suppresses unless there's a concrete exploitable finding — meaning rate limiting is one of the few checklist items CE will *not* catch on its own, so it stays as an explicit project-standards rule.

**What changed:** Rewrote the Security section in `CLAUDE.md` to drop items CE already covers generically (SQL injection, generic auth bypass, generic secrets-in-code — still implicitly covered via CE, just not restated) and add the three genuine gaps: supply chain (`npm audit`, no unpinned/unmaintained deps), security misconfiguration (no debug/stack traces reaching prod), and exceptional conditions (fail closed, not open).

---

## 2026-07-21 — Verified CE plugin installed; fixed a checklist conflict with CE's own reviewer

**Verification:** Confirmed the plugin is installed at `~/.claude/plugins/cache/compound-engineering-plugin` v3.19.0 and enabled in `~/.claude/settings.json`. Inspected `ce-code-review`'s source directly — it has a dedicated `project-standards-reviewer` persona (`references/personas/project-standards-reviewer.md`) whose specific job is to glob for `**/CLAUDE.md` and `**/AGENTS.md`, read them, and cite their rules as binding review criteria ("every finding must cite a specific rule from a specific standards file"). This confirms merging our checklist into `CLAUDE.md` (previous entry below) was the right call — it's actively read and enforced, not just optional context.

**Conflict found and fixed:** CE's built-in `testing-reviewer` persona explicitly instructs itself *not* to flag aggregate coverage percentages ("don't flag 'coverage is below 80%.' Flag specific untested branches that matter"). Our merged checklist in `CLAUDE.md` had `Coverage: >80% for auth/security-critical code`, which is exactly the pattern CE's own reviewer is told to ignore — so it would have sat there as a rule that never actually triggers a finding. Replaced with branch-level language matching CE's actual methodology: "Specific untested branches that matter (new error paths, lifecycle guards, early returns) — not aggregate coverage percentages."

**No conflict found in the security section:** CE's `security-reviewer` persona does independent, anchored vulnerability detection (verifiable SQL injection, missing CSRF, unauthenticated endpoints) — separate from and complementary to `project-standards-reviewer` citing our named OWASP rules. Two different personas, two different jobs, no overlap.

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
