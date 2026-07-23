# Testing Strategy & Checklist

See [01-MASTER_STATE.md](./01-MASTER_STATE.md) for current project status.

## 🎯 OUR TESTING PHILOSOPHY

**Approach: Code First, Tests After** (Pragmatic, not TDD)

### Why?
- Requirements change frequently (multilingual, split types, edge cases)
- Exploring code first is faster than guessing upfront
- When requirements change → update code + tests together
- Faster feedback loop

### Our Workflow
```
1. Build feature (service/component)
   └─ Make it work manually
   
2. Write tests immediately after
   └─ Lock in the behavior
   
3. Before commit
   └─ Verify tests pass
   └─ Check coverage (backend: 80%+)
   
4. Commit with code + tests together
```

---

## 📋 TESTING CHECKLIST BY COMPONENT TYPE

### Backend Service Example
```
NEW FILE: src/services/__tests__/expenseService.test.ts

Tests must cover:
✅ Happy path (successful operation)
✅ Error cases (validation failures, not found, unauthorized)
✅ Edge cases (empty data, null, boundary values)
✅ Multilingual errors (throw AppError with i18n key)

Commands:
✅ npm test                # Run all tests
✅ npm run test:coverage   # View coverage (target: 80%+)

Commit message:
"feat: add expense service with 12 unit tests (85% coverage)"
```

### Frontend Component Example
```
NEW FILE: src/screens/__tests__/ExpenseListScreen.test.tsx

Tests must verify:
✅ Component renders without crashing
✅ Buttons exist and are clickable
✅ Correct API endpoints called (/api/expenses)
✅ Accept-Language header sent (for i18n)
✅ Error states are unit-tested, not just checked manually on mobile — CE's testing-reviewer flags untested error paths as a FAIL criterion (see CLAUDE.md)

Commit message:
"feat: add ExpenseListScreen with unit tests + manual mobile verification"
```

---

## 🔒 SECURITY TESTING (Auth Priority)

### When testing Auth endpoints (signup, login):

**Input Validation:**
- ✅ Empty fields rejected
- ✅ Invalid email format rejected
- ✅ Weak passwords rejected (8+ chars, uppercase+lowercase+number+special)
- ✅ Common passwords rejected (password123, admin123)
- ✅ Name validation: 2-100 chars, letters/spaces/hyphens/apostrophes only

**Security:**
- ✅ Duplicate email: Generic error message (no email enumeration leak!)
- ✅ Password hashed with bcrypt (never plaintext in logs)
- ✅ JWT token generated and valid
- ✅ No timing attacks (constant-time comparison)

**Edge Cases:**
- ✅ Names with apostrophes allowed (O'Brien)
- ✅ Names with hyphens allowed (Anne-Marie)
- ✅ Email normalized to lowercase

See: `PROJECT_MEMORY/AUTH_TESTING_PLAN.md` (if created) for detailed test cases

---

## 📊 WHAT "WELL TESTED" MEANS HERE

CE's `testing-reviewer` persona is explicitly told to ignore aggregate coverage percentages ("don't flag 'coverage is below 80%'") — it flags specific untested branches instead. So this project doesn't track a coverage-% target; a change is well-tested when:
- Happy path is covered
- Error cases are covered (validation failures, not found, unauthorized)
- Edge cases are covered (empty, null, boundary values)
- New error paths, lifecycle guards, and early returns specifically have tests — these are what actually get flagged in review, not an aggregate number

---

## 📁 TEST FILE LOCATIONS

### Backend
- Location: `backend/src/[feature]/__tests__/[feature].test.ts`
- Runtime: Jest (`npm test`)
- Coverage: `npm run test:coverage`
- Pattern: Arrange-Act-Assert

### Frontend  
- Location: `frontend/src/[feature]/__tests__/[feature].test.tsx`
- Runtime: Vitest (`npm test`)
- No E2E automation (use manual Expo Go testing instead)

---

## 🚀 BEFORE COMMITTING

```bash
# Backend
cd backend
npm test              # All tests pass?

# Frontend
cd frontend
npm test              # Tests pass?

# Manual Testing
# Load on Expo Go, verify:
# - Loading states work
# - Error states work
# - Happy path works
# - No crashes
```

---

## ✋ COMMON MISTAKES TO AVOID

❌ **Writing TDD first** - We don't do this (too many requirement changes)  
❌ **Hardcoded sleep() in tests** - Use mocks instead  
❌ **Tests that depend on each other** - Each test must run independently  
❌ **Vague test names** - Name should describe what it validates  
❌ **Committing without tests** - Always add tests with code  

---

**Remember:** Code First → Tests Second → Commit Together ✨
