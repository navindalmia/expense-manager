# PROJECT_MEMORY - Persistent Project Context

**Location:** `./PROJECT_MEMORY/` (in repo root, checked into git)  
**Purpose:** Single source of truth for project state, blockers, patterns, and quality standards  
**Updated:** Every session when saving progress

---

## 📚 QUICK REFERENCE

### 🚀 START HERE
Read **[`01-MASTER_STATE.md`](./01-MASTER_STATE.md)** first when:
- Starting a new session
- Checking what's the current blockers
- Looking for next prioritized steps
- Asking "where were we?"

**It contains:**
- Current version & status
- What's committed vs uncommitted
- **Critical blockers (don't forget!)**
- Prioritized next steps

---

### 📋 BY PURPOSE

**"What's the current project state?"**
→ Read [`01-MASTER_STATE.md`](./01-MASTER_STATE.md) - Current blockers, version, next steps

**"What's the workflow? How do I commit?"**  
→ Read [`02-WORKFLOW.md`](./02-WORKFLOW.md) - **Code → Tests → Code Review → Test Mobile → Commit**

**"I need to know what breaks things"**
→ Read [`01-MASTER_STATE.md`](./01-MASTER_STATE.md) - **CRITICAL BLOCKERS** section

**"I need to fix a bug"**  
→ Read [`03-CODING_PATTERNS.md`](./03-CODING_PATTERNS.md) - Database, API, TypeScript patterns

**"I'm writing a test"**
→ Read [`04-TESTING_STRATEGY.md`](./04-TESTING_STRATEGY.md) - Coverage goals, test checklist

**"I need to review code"**
→ Read [`05-QUALITY_STANDARDS.md`](./05-QUALITY_STANDARDS.md) - SOLID, security, code review gate

**"What does the architecture look like?"**
→ Read [`01-MASTER_STATE.md`](./01-MASTER_STATE.md#-architecture-notes) - Tech stack, database schema

---

## 📁 FILE STRUCTURE

| File | Purpose | Read When |
|------|---------|-----------|
| **01-MASTER_STATE.md** | Current version, blockers, next steps | Starting session / checking status |
| **02-WORKFLOW.md** | Development process, code review before testing | Before starting work |
| **03-CODING_PATTERNS.md** | Database, API, TypeScript patterns | Writing backend/frontend code |
| **04-TESTING_STRATEGY.md** | Testing approach, checklist, coverage goals | Writing tests |
| **05-QUALITY_STANDARDS.md** | SOLID, security, code review gates | Code reviews, architecture decisions |
| **README.md** | This file - navigation guide | Lost and need help? |

---

## 🎯 THE WORKFLOW

### WHEN STARTING SESSION:
```
1. Open PROJECT_MEMORY/01-MASTER_STATE.md
2. Check CRITICAL BLOCKERS section (don't miss!)
3. Review current state & uncommitted changes
4. See prioritized next steps
5. Go!
```

### WHEN ASKING "WHERE WERE WE?":
```
1. I read 01-MASTER_STATE.md
2. Blockers are right there
3. Current code state is documented
4. Next steps are numbered
5. No context loss!
```

### WHEN SAVING PROGRESS:
```
1. Update 01-MASTER_STATE.md with:
   - What was completed
   - What's uncommitted
   - Any new blockers
   - Updated next steps
2. Commit changes to git
3. Done! Context persists
```

---

## ⚠️ CRITICAL: DON'T FORGET THESE

These are always at the top of `01-MASTER_STATE.md`:

### Blocker 1: Add Member Without Registration
- Feature incomplete, members must be pre-registered
- Need to debug why it's broken
- Bad UX - can't invite unregistered friends

### Pending 1: EditExpenseScreen Date Picker
- Date field needs calendar UI (not text input)
- Screen exists but untested on mobile
- Must fix before v0.2.1 release

---

## 🔄 GIT INTEGRATION

These files are **checked into git** (not in `.gitignore`):
- Changes to memory files = git commits
- Memory travels with repo
- Team sees same context
- Backed up on origin

**Treat like regular project files:**
```bash
git add PROJECT_MEMORY/01-MASTER_STATE.md
git commit -m "docs: update project state - blockers and next steps"
```

---

## 📝 HOW TO UPDATE

### When to update:
- ✅ After each session (save what was done)
- ✅ When discovering new blockers
- ✅ When  completing a task
- ✅ When plans change

### What to update:
- Current state (what's committed/uncommitted)
- Blockers (explain what's stuck)
- Next steps (prioritize clearly)
- Metrics (coverage, build status)

**Example commit message:**
```
docs: update PROJECT_MEMORY - EditExpenseScreen calendar UI pending

- Documented EditExpenseScreen needs date picker (calendar UI)
- Noted member add feature is still broken
- Updated next steps priority
- All blockers clearly marked
```

---

## ✨ BENEFITS

- ✅ **No context loss** - Everything persists
- ✅ **Clear blockers** - Surprises don't happen
- ✅ **Prioritized work** - Always know what's next
- ✅ **Team aligned** - All in git, visible to everyone
- ✅ **Searchable** - Git history of project state
- ✅ **Single entry point** - 01-MASTER_STATE.md has it all

---

## 🚀 QUICK COMMANDS

```bash
# Check status
cat PROJECT_MEMORY/01-MASTER_STATE.md

# Update after session
git add PROJECT_MEMORY/
git commit -m "docs: update project memory"

# See history of changes
git log --oneline PROJECT_MEMORY/

# Check what changed last time
git diff HEAD~1 PROJECT_MEMORY/01-MASTER_STATE.md
```

---

**Remember:** This folder is the source of truth. When you forget where we were, it's all here! 🎯
