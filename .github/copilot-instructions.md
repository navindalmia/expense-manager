# GitHub Copilot Operating Instructions

**Purpose:** Official directive file for Copilot behavior in this repo. READ THIS FIRST ON EVERY TURN.

**Status:** Active - This is your authority file. If written here, I will follow it.

**Last Updated:** May 19, 2026

---

## 🎯 CORE OPERATING PRINCIPLES (NON-NEGOTIABLE)

### 1. SESSION STARTUP - MANDATORY READS (Every Turn)

**READ IN THIS ORDER:**

1. **This file** - `.github/copilot-instructions.md` (you are reading it now)
2. **Project state** - `PROJECT_MEMORY/01-MASTER_STATE.md` (current feature status)
3. **Workflow** - `WORKFLOW.md` (development process)
4. **Configuration** - `.agent.md` (agent behavior rules)

**Time Required:** ~2 minutes. Do this before any work.

### 2. WORKFLOW ENFORCEMENT (Code → Review → Test → Commit)

**NEVER SKIP PHASES:**

```
PHASE 1: IMPLEMENT
├─ Write code
├─ Write tests
└─ Verify: npx tsc --noEmit

PHASE 2: REVIEW (Independent)
├─ Request Reviewer Agent (not self-review)
├─ Wait for ✅ APPROVED

PHASE 3: TEST
├─ Only after Phase 2 ✅ approved
├─ Run: npm test
└─ Manual testing on mobile

PHASE 4: COMMIT
├─ Only after Phase 3 ✅ passed
├─ Single commit with feature + tests
└─ Push to origin
```

**Rule:** Never test before review. Never commit before test. No exceptions.

### 3. PROGRESS TRACKING - EVERY TASK & CODE PHASE (MANDATORY)

**This is non-negotiable. Do this automatically after each completed phase.**

After each completed code phase or task (approximately every 10 minutes of active work):

1. **Update Session Memory** (`/memories/session/[date]-[task].md`):
   - Bugs found & solutions
   - Blockers encountered
   - Patterns that worked
   - Why decisions were made
   - Current progress

2. **Update Project State** (when feature changes status):
   - `PROJECT_MEMORY/01-MASTER_STATE.md`
   - Mark features complete/in-progress
   - Update test results
   - Document next steps

3. **Session End** (when done for the day):
   - Extract reusable patterns to `/memories/user/`
   - Save permanent learnings
   - Keep notes brief (<5 bullet points per topic)

**Trigger:** After completing code phase, test phase, review phase, or every 10 minutes of active work.

### 4. MARKDOWN FILE COMMIT RULES (Strict)

**✅ CAN commit to git:**
- `.instructions.md`, `.agent.md`, `AGENTS.md`, `WORKFLOW.md` (configuration)
- `PROJECT_MEMORY/01-MASTER_STATE.md` (project state)
- `START_HERE.md` (onboarding)
- `.github/copilot-instructions.md` (this file)
- Source code & tests

**❌ NEVER commit:**
- `*_REVIEW*.md`, `*_CODE_REVIEW*.md` (reviews)
- `*_PLAN*.md`, `*_ROADMAP*.md` (planning)
- `*_CHECKPOINT*.md`, `SESSION_*.md` (session notes - use `/memories/session/` instead)
- `TEST_RESULTS*.md`, `TEST_OUTPUT*.md` (test output)

**Principle:** Repo files = system state (permanent). Local files = work-in-progress (ephemeral).

### 5. CRITICAL CODING RULES

1. **Never code review your own code**
   - Request independent Reviewer Agent instead

2. **Always write tests with code**
   - No code without tests
   - Tests in `__tests__/` mirroring structure

3. **Verify TypeScript compiles**
   - Run: `npx tsc --noEmit` before requesting review
   - No `any` types, explicit annotations only

4. **SOLID + DRY principles**
   - Reference: `PROJECT_MEMORY/03-CODING_PATTERNS.md`
   - Reference: `PROJECT_MEMORY/05-QUALITY_STANDARDS.md`

### 6. PRE-COMMIT CHECKLIST (MANDATORY - No commit without these ✅)

**Before ANY commit, verify:**

- [ ] **Code Review:** ✅ APPROVED by independent Reviewer Agent
  - Use principles from: `AGENTS.md` → Code Review Agent section
  - Security check (no secrets, input validation, auth checks)
  - SOLID principles verified (Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion)
  - DRY check (no duplicate code/logic)
  - Error handling complete (try-catch, AppError, logging)
  - Tests exist and meaningful

- [ ] **Tests:** ✅ PASSED
  - Frontend: `npm test -- --run` all pass
  - Backend: `npm test` all pass
  - Coverage adequate (main paths + error cases)

- [ ] **TypeScript:** ✅ COMPILES
  - `npx tsc --noEmit` returns clean
  - No `any` types
  - All functions typed

- [ ] **Quality Standards Met:**
  - Reference: `PROJECT_MEMORY/05-QUALITY_STANDARDS.md`
  - No hardcoded secrets/credentials
  - Logging added (errors, important decisions)
  - Naming is clear and descriptive

**RULE: If any checkbox is ❌, DO NOT COMMIT. Period.**
**Code review is NOT optional. Independent review MUST happen before any code reaches main.**

---

## 🔄 AUTO-EXECUTE CHECKLIST

**At Every Turn Start:**

- [ ] Read `.github/copilot-instructions.md` (this file)
- [ ] Read `PROJECT_MEMORY/01-MASTER_STATE.md`
- [ ] Read `WORKFLOW.md`
- [ ] **AGENT INSTRUCTION:** Check AUTO-EXECUTE TASKS section below
  - If any tasks exist: Execute them BEFORE other work
  - Mark each ✅ when complete
  - Remove completed tasks
  - Do not proceed to other work until all tasks executed
- [ ] If session has been running >10 minutes: Update session memory files

**Auto-Execute Tasks** (Write tasks here - Agent executes them without reminding):

```
[Write tasks here - I will auto-execute]
[Example: "- [ ] Fix backend mock setup for emailVerificationService tests"]
[Example: "- [ ] Run manual Expo testing for deep linking"]
```

(Currently empty - user fills this section)

---

## 💬 HOW TO COMMUNICATE WITH ME

### Task Instructions
Write in this file:
```
- [ ] Task description here
```
I will auto-execute without being asked.

### Workflow Rules
Write in:
- `WORKFLOW.md` (development process)
- `.agent.md` (agent behavior)
- `.instructions.md` (coding standards)

I will follow these automatically.

### Project State
Write in:
- `PROJECT_MEMORY/01-MASTER_STATE.md` (current status)

I will read this at turn start.

---

## � SESSION MEMORY LOCATION

Agent session tracking is stored in `/memories/session/` files (not in repo).

---
## 🔐 COPILOT PERMISSIONS & BOUNDARIES

**Write Access:**
- ✅ **CAN:** Read/write files INSIDE repo (`c:\nd\repos\expense-manager\`)
- ✅ **CAN:** Create files, edit code, run tests
- ✅ **CAN:** Commit to git (repo only)

**CANNOT:**
- ❌ Write outside repo directory
- ❌ Modify machine registry/system files
- ❌ Delete files without explicit permission
- ❌ Drop tables or database objects without explicit permission
- ❌ Delete repo or destructive operations
- ❌ Install system software
- ❌ Modify environment variables permanently
- ❌ Access user files outside repo

**Scope:** This repo only. No changes to machine outside `c:\nd\repos\expense-manager\`

---
## � RULE VIOLATION RECOVERY

If you violate a rule (commit without review, skip testing, etc.):

1. **STOP immediately** — Do not continue
2. **Report to user:** "[RULE VIOLATION] [which rule] [what happened] [corrective action]"
3. **Correct the error** — Roll back changes, revert commits, etc.
4. **Do NOT proceed** until issue is resolved

**Examples:**
- "[RULE VIOLATION] Attempted commit without review approval. Reverting commit."
- "[RULE VIOLATION] Skipped testing phase. Running full test suite now."
- "[RULE VIOLATION] Failed to update session memory at 10-min mark. Updating now."

---

## 📞 DEBUGGING THIS FILE

I am independent when:
1. ✅ I read this file first every turn
2. ✅ I don't ask permission for things written here
3. ✅ I auto-execute tasks without reminders
4. ✅ I update memory every 10 minutes automatically
5. ✅ I follow WORKFLOW.md strictly
6. ✅ I know which MD files can/cannot be committed

**I am NOT independent when:**
- ❌ You have to keep reminding me
- ❌ I ask "should I?" instead of doing it
- ❌ I skip memory updates
- ❌ I test before code review approval

---

## 📞 DEBUGGING THIS FILE

If I'm not following something:
1. Check: Is it in this file?
2. Check: Did I read it at turn start?
3. If yes to both: I made an error (tell me to re-read this file)
4. If no: Write it in this file explicitly

**This is your source of truth. If I'm not doing it, it's either:**
- Not in this file (add it)
- I didn't read this file (I will next turn)
- I made a mistake (call me out)

---

## ✅ IMPLEMENTATION CHECKLIST

Has this file been created? Yes, May 19, 2026.

**What it replaces:**
- All scattered "DO NOT" reminders → Consolidated here
- All "remember to..." nagging → Automated 10-min tracking
- Inconsistent rules → Single source of truth

**What it enables:**
- Full independence (I read this, I follow it)
- No reminders needed (rules are here)
- Crash recovery (10-min snapshots)
- Clean git history (markdown rules enforced)

---

**This file is the BIBLE. If written here, I will do it. No questions asked.**
