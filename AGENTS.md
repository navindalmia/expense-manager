# Specialized Agents for Expense Manager

**Workspace:** Expense Manager  
**Purpose:** Define independent agents for different development roles  
**Last Updated:** June 22, 2026 (Restructured to official Copilot pattern)

---

## 🎯 QUICK NAVIGATION

All agents are now **Copilot-native** and can be invoked independently:

| Agent | File | Trigger |
|-------|------|---------|
| **🛠️ Code Implementer** | [`.agents/implementer.agent.md`](./.agents/implementer.agent.md) | `implement`, `fix`, `refactor` |
| **🔍 Code Reviewer** | [`.agents/reviewer.agent.md`](./.agents/reviewer.agent.md) | `review`, `audit`, `security-check` |
| **✅ Test Executor** | [`.agents/tester.agent.md`](./.agents/tester.agent.md) | `test`, `verify`, `manual-test` |
| **📐 Architect/Planner** | [`.agents/planner.agent.md`](./.agents/planner.agent.md) | `plan`, `design`, `architect`, `schema` |

**Main Router:** [`.agent.md`](./.agent.md) - Coordinates all agents

---

## 🤖 AGENT DEFINITIONS

### 1. CODE IMPLEMENTER AGENT (DEFAULT)

**See:** [`.agents/implementer.agent.md`](./.agents/implementer.agent.md)

**Role:** Write features, create components, implement business logic  
**Trigger:** When implementing new features or fixing bugs  

**Quick Summary:**
- Write implementation code
- Create unit tests immediately after
- Verify TypeScript compiles
- Follow coding patterns from `PROJECT_MEMORY/03-CODING_PATTERNS.md`
- Do NOT run tests yourself (that's Tester's job)
- Do NOT do code review (that's Reviewer's job)

---

### 2. CODE REVIEW AGENT

**See:** [`.agents/reviewer.agent.md`](./.agents/reviewer.agent.md)

**Role:** Independent code quality & security verification  
**Trigger:** When code is complete and tests exist  

**Quick Summary:**
- Security audit (OWASP checklist from 05-QUALITY_STANDARDS.md)
- SOLID principles verification
- Test coverage assessment
- DRY principle checks
- Error handling review
- Approve/Reject with clear feedback

---

### 3. TEST EXECUTION AGENT

**See:** [`.agents/tester.agent.md`](./.agents/tester.agent.md)

**Role:** Run tests, integration testing, manual testing  
**Trigger:** After code review APPROVED  

**Quick Summary:**
- Run unit tests: `npm test -- --run` (frontend), `npm test` (backend)
- Verify test suite passes
- Manual testing on Expo Go
- Test deep linking on mobile
- Document test results

---

### 4. ARCHITECT / PLANNER AGENT

**See:** [`.agents/planner.agent.md`](./.agents/planner.agent.md)

**Role:** Design features, plan implementation, schema decisions  
**Trigger:** Before implementation starts  

**Quick Summary:**
- Read feature requirements
- Design database schema
- Plan API endpoints
- Design component structure
- Create implementation plan
- Document decisions

---

### 5. UI TESTING AGENT

**See:** [`.agents/tester.agent.md`](./.agents/tester.agent.md) (Mobile Testing Section)

**Role:** Automated browser/UI testing via Playwright  
**Trigger:** When frontend feature is ready for E2E validation

---

### 6. DATABASE VERIFICATION AGENT

**See:** [`.agents/tester.agent.md`](./.agents/tester.agent.md) (Integration Testing Section)

**Role:** Validate data persistence and consistency via database queries  
**Trigger:** Runs in parallel with UI Testing Agent

---

## 🔄 WORKFLOW ORCHESTRATION

### Standard Feature Workflow

```
USER REQUEST
  ↓
PLANNER (`.agents/planner.agent.md`): Design + Implementation Plan
  ↓
IMPLEMENTER (`.agents/implementer.agent.md`): Write code + tests
  ↓
REVIEWER (`.agents/reviewer.agent.md`): Audit code
  ↓
TESTER (`.agents/tester.agent.md`): Run all tests
  ↓
IMPLEMENTER: Commit + push
```

### How to Invoke Specific Agents

**Planning a feature:**
```
@planner "Design the settlement screen feature"
```

**Implementing a feature:**
```
@implementer "Implement email verification service with tests"
```

**Code review:**
```
@reviewer "Please audit emailVerificationService.ts for OWASP and SOLID principles"
```

**Testing:**
```
@tester "Run the full test suite for email verification (frontend + backend)"
```

---

## 📋 AGENT COMMUNICATION PROTOCOL

**Each agent produces:**
1. Clear decision/status (✅ PASSED, ❌ FAILED)
2. Detailed reasoning
3. Specific actionable feedback
4. Evidence (line numbers, error messages, etc.)

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

---

## 📚 REFERENCE FILES

Every agent should read:
- [PROJECT_MEMORY/01-MASTER_STATE.md](./PROJECT_MEMORY/01-MASTER_STATE.md) - Current state
- [WORKFLOW.md](./WORKFLOW.md) - Development process
- [PROJECT_MEMORY/05-QUALITY_STANDARDS.md](./PROJECT_MEMORY/05-QUALITY_STANDARDS.md) - Quality gates
- [.instructions.md](./.instructions.md) - Coding standards
- [.agent.md](./.agent.md) - Agent router
- Individual agent files in `.agents/` folder
