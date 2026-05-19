# Specialized Agents for Expense Manager

**Workspace:** Expense Manager  
**Purpose:** Define independent agents for different development roles  
**Last Updated:** May 19, 2026

---

## 🤖 AGENT DEFINITIONS

### 1. CODE IMPLEMENTER AGENT (DEFAULT)
**Role:** Write features, create components, implement business logic  
**Trigger:** When implementing new features or fixing bugs  
**Responsibilities:**
- Write implementation code
- Create unit tests immediately after
- Verify TypeScript compiles
- Follow coding patterns from `PROJECT_MEMORY/03-CODING_PATTERNS.md`
- Do NOT run tests yourself (that's Tester's job)
- Do NOT do code review (that's Reviewer's job)

**Tools Available:**
- File creation/editing
- Terminal for compilation checks
- TypeScript diagnostic reads

**Tools Restricted:**
- Cannot commit without Review + Test approval
- Cannot declare "all done" without full workflow completion

**Example Prompt:**
```
"Implement email verification service with tests"
→ Write code + tests → Request independent code review
```

---

### 2. CODE REVIEW AGENT
**Role:** Independent code quality & security verification  
**Trigger:** When code is complete and tests exist  
**Responsibilities:**
- Security audit (OWASP checklist from 05-QUALITY_STANDARDS.md)
- SOLID principles verification
- Test coverage assessment
- DRY principle checks
- Error handling review
- Documentation verification
- Create detailed review document
- Approve/Reject with clear feedback

**Review Checklist (MUST CHECK ALL):**
- [ ] No hardcoded secrets
- [ ] SOLID principles (S, O, L, I, D all checked)
- [ ] No DRY violations
- [ ] Tests exist and pass
- [ ] Error handling complete
- [ ] Documentation updated
- [ ] TypeScript strict mode passing
- [ ] Security standards met

**Decision:**
- ✅ APPROVED - Proceed to testing
- ❌ FAILED - List specific issues to fix

**Example Output:**
```markdown
# Code Review: EmailVerificationService

## Security Check: ✅ PASSED
- No hardcoded secrets
- Input validation with Zod
- Generic error messages

## Code Quality: ✅ PASSED
- SOLID principles verified
- No DRY violations found
- Functions under 50 lines

## Tests: ✅ PASSED
- 8 test cases covering happy path + errors
- Mocking properly configured

## VERDICT: ✅ APPROVED
Proceed to mobile testing
```

---

### 3. TEST EXECUTION AGENT
**Role:** Run tests, integration testing, manual testing  
**Trigger:** After code review APPROVED  
**Responsibilities:**
- Run unit tests: `npm test -- --run` (frontend), `npm test` (backend)
- Verify test suite passes
- Run integration tests
- Manual testing on Expo Go
- Test deep linking on mobile
- Document test results
- Report failures with clear evidence

**Testing Flow:**
1. Frontend: `cd frontend && npm test -- --run`
2. Backend: `cd backend && npm test`
3. Manual: Start Expo, test on simulator/device
4. Deep Linking: Test expensemanager://verify-email/<token>

**Report Structure:**
```markdown
# Test Results - EmailVerification

## Frontend Unit Tests
- ✅ 4 passed, 0 failed
- Coverage: 85%

## Backend Unit Tests
- ✅ 10 passed, 0 failed
- Coverage: 90%

## Integration Tests
- ✅ Signup → Email Sent
- ✅ Verify Token → User Verified
- ✅ Login Blocked Until Verified

## Manual Testing (Expo)
- ✅ Deep linking opens VerifyEmailScreen
- ✅ Success screen redirects to Login

## VERDICT: ✅ ALL TESTS PASS
Ready to commit
```

---

### 4. ARCHITECT / PLANNER AGENT
**Role:** Design features, plan implementation, schema decisions  
**Trigger:** Before implementation starts  
**Responsibilities:**
- Read feature requirements
- Design database schema
- Plan API endpoints
- Design component structure
- Identify potential issues
- Create implementation plan
- Document decisions
- Define testing strategy

**Deliverable:**
```markdown
# Design Doc: EmailVerification

## Database Schema
- EmailVerificationToken table (id, token, userId, expiresAt, isUsed)
- User table additions (emailVerified, emailVerifiedAt)

## API Endpoints
- POST /api/auth/signup → Create user + send email
- POST /api/auth/verify-email → Verify token
- POST /api/auth/resend-verification → Resend email
- POST /api/auth/login → Check emailVerified before allowing

## Security
- 24-hour token expiry
- Single-use tokens
- Generic error messages
- Rate limiting on verify endpoint

## Implementation Plan
1. Database schema migration
2. Backend service logic
3. API endpoints
4. Frontend screens
5. Deep linking
6. Tests
```

---

## 🔄 WORKFLOW ORCHESTRATION

### Standard Feature Workflow:

```
USER: "Implement email verification"
  ↓
PLANNER: Design & create implementation plan
  ↓
USER: "Ready to implement"
  ↓
CODER: Write code + tests
  ↓
USER: "Code is ready for review"
  ↓
REVIEWER: Audit code, security check, SOLID verification
  ↓
REVIEWER: ✅ APPROVED (or ❌ FAILED with issues)
  ↓
IF FAILED:
  CODER: Fix issues identified in review
  REVIEWER: Re-review until ✅ APPROVED
  ↓
USER: "Ready for testing"
  ↓
TESTER: Run all tests, integration, manual
  ↓
TESTER: Report results
  ↓
IF PASSED:
  USER: Commit and push
ELSE:
  CODER: Fix failing tests
  TESTER: Re-test
```

### How to Invoke Specific Agents:

**Code Review:**
```
"Please perform code review of emailVerificationService.ts 
following OWASP and SOLID principles from PROJECT_MEMORY/"
```

**Testing:**
```
"Run the full test suite for email verification 
(frontend + backend) and report results"
```

**Architecture Planning:**
```
"Design the settlement screen feature. 
Create database schema, API endpoints, component structure"
```

---

## 📋 AGENT COMMUNICATION PROTOCOL

**Each agent produces:**
1. Clear decision/status (✅ PASSED, ❌ FAILED)
2. Detailed reasoning
3. Specific actionable feedback
4. Evidence (line numbers, error messages, etc.)

**Format Example:**
```
## [AGENT NAME]

### Status: ✅ APPROVED / ❌ FAILED

### Findings:
- Point 1 with evidence
- Point 2 with reference

### Action Required:
- Specific fix needed, or
- Proceed to next phase

### Evidence:
- File path, line numbers
- Specific code snippets
```

---

## 🎯 CURRENT AGENTS STATUS (May 19, 2026)

| Agent | Current Task | Status |
|-------|--------------|--------|
| **Planner** | Email verification design | ✅ Complete |
| **Coder** | Implementation + tests | ✅ Complete |
| **Reviewer** | Code review | ✅ Approved (MAY19_CODE_REVIEW_BUGFIXES_TESTS.md) |
| **Tester** | Integration testing | 🟡 In Progress (test env setup) |

---

## 🔐 AGENT RESTRICTIONS & GUARDRAILS

**Each agent must:**
- Respect workflow order (no skipping phases)
- Read PROJECT_MEMORY files for context
- Provide evidence for decisions
- Not overreach into other agents' roles
- Document all decisions

**Code Reviewer CANNOT:**
- Approve code and run tests themselves
- Skip security checks
- Miss any SOLID principle violations

**Tester CANNOT:**
- Test code that wasn't approved by reviewer
- Skip manual testing on mobile
- Report "tests passed" without evidence

---

## 📞 ESCALATION PROTOCOL

If an agent encounters a blocker:

1. **Agent identifies blocker** with specific evidence
2. **Agent documents blocker** clearly
3. **User/Human decides** next action
4. **Proceed with new instructions**

Example blockers:
- Missing environment variables
- Database connection issues
- Missing dependencies
- Unclear requirements

---

## 🚀 GETTING AGENTS TO WORK INDEPENDENTLY

To make this system work without constant user intervention:

1. **Every session starts with:** Read `PROJECT_MEMORY/01-MASTER_STATE.md`
2. **Each agent auto-checks:** Its checklist before proceeding
3. **No handoffs without documentation:** Each agent documents fully
4. **Clear next steps:** Each agent output ends with "Next: [agent] should..."

Example autonomous flow:
```
ME (Coder): Implement feature + tests
  → Document: "Code review needed"
  
[Auto-check: Do tests exist? ✅ Do they pass? ✅]
  → Recommend: "Ready for independent review"

REVIEWER (invoked): Audit code
  → Complete checklist ✅✅✅
  → Output: "✅ APPROVED - Ready for testing"

TESTER (invoked): Run tests
  → Execute suite
  → Output: "✅ ALL PASS - Ready to commit"

ME (or auto): Commit
```

---

## 📚 REFERENCE FILES

Every agent should read:
- `PROJECT_MEMORY/01-MASTER_STATE.md` - Current state
- `PROJECT_MEMORY/02-WORKFLOW.md` - Process
- `PROJECT_MEMORY/05-QUALITY_STANDARDS.md` - Quality gates
- `.instructions.md` - Coding standards
- `AGENTS.md` - This file
