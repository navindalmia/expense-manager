# Development Workflow & Process

**Last Updated:** April 12, 2026

---

## 🔄 THE WORKFLOW

### Phase 1: Code Review FIRST
**CRITICAL RULE:** Always code review BEFORE testing

```
After code changes complete
  ↓
Request independent agent code review
  ↓
Wait for review results
  ↓
Fix any issues found
  ↓
ONLY THEN proceed to testing
```

**Why:** Catches bugs early, prevents shipping broken code to mobile

---

### Phase 2: Mobile Testing
```
Code passes review (all issues fixed)
  ↓
Test on mobile (Expo Go)
  ↓
Verify requirements met
  ↓
Document results
  ↓
Ready to commit
```

---

### Phase 3: Commit
```
Commit all related changes together
  ↓
Include code + tests in one commit
  ↓
Tag significant versions (v0.2.1, etc.)
  ↓
Push to origin
```

---

## ⚠️ CRITICAL: DON'T SKIP CODE REVIEW

**WRONG WORKFLOW:**
```
Write code → Test on mobile → Commit ❌
```

**RIGHT WORKFLOW:**
```
Write code → Code review → Fix issues → Test on mobile → Commit ✅
```

---

## 📋 CODE REVIEW CHECKLIST

When requesting independent code review, the reviewer checks:

- ✅ No security vulnerabilities
- ✅ SOLID principles followed
- ✅ No DRY violations (code duplication)
- ✅ Tests included and passing
- ✅ Error handling present
- ✅ No hardcoded secrets
- ✅ Documentation updated
- ✅ TypeScript strict mode passing

See: `PROJECT_MEMORY/05-QUALITY_STANDARDS.md` for full code review gate

---

## 🚀 STEP-BY-STEP PROCESS

### 1. Write Feature
```
Create feature (backend service, frontend component)
  ↓
Make it work manually
  ↓
Write tests immediately after
  ↓
Verify tests pass: npm test
  ↓
Check coverage: npm run test:coverage
```

### 2. Request Code Review
```
All changes complete
  ↓
Create summary of changes
  ↓
"@AGENT code review: [summary]"
  ↓
Wait for independent review
```

### 3. Fix Issues
```
Review comes back with findings
  ↓
Fix security issues first
  ↓
Fix architecture/SOLID issues
  ↓
Fix code quality issues
  ↓
Verify tests still pass
  ↓
Done? Re-request review or proceed
```

### 4. Mobile Testing
```
Code passes review
  ↓
Load on Expo Go mobile app
  ↓
Test happy path
  ↓
Test error states
  ↓
Test edge cases
  ↓
Document results
```

### 5. Commit & Push
```
All tests pass (unit + mobile)
  ↓
git add -A
git commit -m "feat: [feature name]"
git push origin master
git tag v0.2.1 (if significant)
git push --tags
```

---

## ✅ COMMIT MESSAGE TEMPLATE

```
feat: add expense create/edit/list flows

- CreateExpenseScreen component with form
- EditExpenseScreen with calendar date picker
- ExpenseListScreen with auto-refresh on focus
- 25 unit tests covering happy/error paths (82% coverage)
- Mobile tested on Expo Go (all flows work)
- Code review passed (security + architecture)

Fixes: #42
Closes: #43
```

---

## 🚫 THINGS THAT BLOCK COMMIT

❌ Code review not done or issues not fixed  
❌ Tests failing or coverage below 80%  
❌ Security vulnerabilities  
❌ TypeScript errors  
❌ Uncommitted changes  
❌ No mobile testing  

---

## ✨ BENEFITS OF THIS WORKFLOW

✅ **Bugs caught early** (by code review, not mobile testing)  
✅ **Quality consistent** (SOLID, DRY, security enforced)  
✅ **No surprises on mobile** (already validated by review)  
✅ **Clean git history** (all related changes in one commit)  
✅ **Team aligned** (everyone follows same process)  

---

**TL;DR:**
Code → Tests → **Code Review** → Fix Issues → Mobile Test → Commit
