# WORKFLOW.md - Single Source of Truth

**Purpose:** Centralized workflow definition  
**Status:** Canonical - all other files reference this  
**Last Updated:** May 19, 2026

---

## 🎯 CORE PRINCIPLE: Only Commit After Action Taken

**What gets committed to git (ALLOWED):**
- ✅ Code + tests (all phases passed)
- ✅ Configuration system (.instructions.md, .agent.md, AGENTS.md, WORKFLOW.md, .cursorrules)
- ✅ Source files (backend/src, frontend/src)
- ✅ Project tracking (PROJECT_MEMORY/01-MASTER_STATE.md, other context files)
- ✅ Onboarding docs (START_HERE.md, ARCHITECTURE.md)

**What stays LOCAL (never committed - .gitignore enforced):**
- ❌ Review documents (`*_REVIEW*.md`, `*_CODE_REVIEW*.md`)
- ❌ Checkpoint files (`*_CHECKPOINT*.md`, `*_SESSION*.md`)
- ❌ Planning documents (`*_PLAN*.md`, `*_ROADMAP*.md`, `*_PROPOSAL*.md`)
- ❌ Test output reports (`TEST_RESULTS*.md`, `TEST_OUTPUT*.md`)
- ❌ Session notes (use `/memories/session/` in user's home directory instead)

**Principle:**
- **Repo MD files** = System configuration & project state (permanent reference)
- **Local MD files** = Work-in-progress (ephemeral decision documents, session notes)
- Once decisions are made and actions taken, the code becomes the source of truth

---

## 🔄 THE WORKFLOW (Non-Negotiable)

All development follows this sequence. **No exceptions. No skipping phases.**

```
PHASE 1: CODE IMPLEMENTATION
├─ Write feature code
├─ Write unit tests (same commit)
└─ Verify TypeScript: npx tsc --noEmit ✅

PHASE 2: INDEPENDENT CODE REVIEW
├─ Reviewer audits code (not original author)
├─ Security check (OWASP)
├─ SOLID principles verify
├─ Test coverage assess
└─ Decision: ✅ APPROVED or ❌ FAILED

PHASE 3: TESTING
├─ Unit tests: npm test -- --run (frontend), npm test (backend)
├─ Integration tests
├─ Manual testing (Expo device/simulator)
└─ Document results

PHASE 4: COMMIT
├─ Single commit with feature + tests
├─ Clear message: "feat: implement X"
└─ Push to origin
```

---

## ✅ QUALITY GATES

### Before Review (Must Pass)
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Tests exist and pass: `npm test -- --run`
- [ ] No hardcoded secrets

### For Review Approval (Reviewer Checks)
- [ ] Security: No vulnerabilities (OWASP checklist)
- [ ] Architecture: SOLID principles verified
- [ ] Quality: No DRY violations, <50 line functions
- [ ] Testing: Good coverage, error cases tested
- [ ] Documentation: Updated or added

### Before Commit (Must Pass)
- [ ] Code review: ✅ APPROVED
- [ ] Tests: ✅ PASS
- [ ] Manual testing: ✅ VERIFIED

---

## 📋 REVIEW CHECKLIST (For Reviewer Agent)

Use this when doing code review:

**Security (OWASP)**
- [ ] No hardcoded secrets
- [ ] Input validation present (Zod)
- [ ] Server-side validation (trust nothing from client)
- [ ] Authorization checks on protected resources
- [ ] Generic error messages (no info leakage)
- [ ] Password hashing (bcrypt, never reversible)

**Code Quality**
- [ ] Meaningful names (variables, functions, classes)
- [ ] No functions > 50 lines
- [ ] Comments explain WHY, not WHAT
- [ ] No duplicate code (DRY)
- [ ] Consistent formatting

**Architecture**
- [ ] SOLID principles followed (S, O, L, I, D)
- [ ] Separation of concerns
- [ ] No circular dependencies
- [ ] Proper error handling (try-catch, AppError)

**Testing**
- [ ] Tests exist for new code
- [ ] Happy path + error cases tested
- [ ] Mocking used correctly
- [ ] No skipped tests

**TypeScript**
- [ ] No `any` types
- [ ] Function parameters typed
- [ ] Return types explicit
- [ ] Interfaces used appropriately

---

## 🧪 TEST EXECUTION (For Tester Agent)

**Frontend:**
```bash
cd frontend
npm test -- --run
```

**Backend:**
```bash
cd backend
npm test
```

**Manual (Expo):**
1. Start Expo: `npx expo start`
2. Test on simulator/device
3. Verify deep linking: `expensemanager://verify-email/<token>`
4. Test error scenarios

---

## 📝 CODE REVIEW DECISION TEMPLATE

When review is complete, provide:

```markdown
# Code Review: [Feature Name]

## Security: ✅ PASSED / ❌ FAILED

## Code Quality: ✅ PASSED / ❌ FAILED

## Architecture: ✅ PASSED / ❌ FAILED

## Testing: ✅ PASSED / ❌ FAILED

## VERDICT: ✅ APPROVED / ❌ FAILED

### Action Required (if failed):
- [ ] Fix issue #1
- [ ] Fix issue #2

### Evidence:
- File: line number
- Specific code snippet
```

---

## 🚀 HOW AGENTS USE THIS

Every agent:
1. Reads this file at session start
2. References specific phases/gates when working
3. Follows sequence strictly (no skipping)
4. Knows if they can proceed to next phase

Example:
- **Coder:** Completes Phase 1, requests review (Phase 2)
- **Reviewer:** Executes Phase 2, approves or rejects
- **Tester:** Only starts Phase 3 if Phase 2 ✅ approved
- **Committer:** Only commits after Phase 3 ✅ passes

---

## 📝 PROGRESS TRACKING (Every 10 Minutes)

**See: [.agent.md](./.agent.md) → PROGRESS TRACKING & LEARNING** for detailed rules.

**Quick reminder:**
- Every 10 minutes: Update `/memories/session/[task].md` (learning, bugs, blockers)
- Every feature: Update `PROJECT_MEMORY/01-MASTER_STATE.md` (project progress)
- Session end: Extract insights to `/memories/user/` (persistent learning)

**Why?** Prevent context loss during crashes. Previous sessions taught us the cost of not tracking progress.
