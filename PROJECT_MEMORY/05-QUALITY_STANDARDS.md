# Quality Standards & Review Gates

**For code reviews, security checks, and architectural decisions**  
**Last Updated:** 2026-07-21  
**Status:** Detailed reference — the condensed, always-in-context version that `/ce-code-review` actually applies lives in [CLAUDE.md](../CLAUDE.md#code-review-standards-applies-to-ce-code-review). Keep both in sync when either changes.  
**Navigation:** See [01-MASTER_STATE.md](./01-MASTER_STATE.md) for current project status

---

## 🏗️ ARCHITECTURE PRINCIPLES

### SOLID Principles
- **S**ingle Responsibility: One class/function = one reason to change
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Derived classes must be substitutable for base
- **I**nterface Segregation: No client depends on unnecessary interfaces
- **D**ependency Inversion: Depend on abstractions, not concrete implementations

### Design Patterns
- **DRY** - Don't Repeat Yourself (avoid code duplication)
- **KISS** - Keep It Simple, Stupid (avoid over-engineering)
- **YAGNI** - You Aren't Gonna Need It (don't build features you won't use)
- **SOC** - Separation of Concerns (distinct responsibilities in separate modules)
- **MVP** - Minimum Viable Product (smallest feature set to validate)

---

## 🔒 SECURITY CHECKLIST (OWASP Top 10:2025)

CE's `security-reviewer` persona already hunts injection (SQL/XSS/shell), auth/authz bypass, secrets-in-code-or-logs, SSRF, path traversal, and insecure deserialization generically at high confidence — no need to restate those here. This checklist is specifically the gaps beyond that: things CE explicitly does *not* auto-flag as "generic hardening advice," plus categories that jumped in the 2025 revision.

- ✅ **Rate limiting** on brute-forceable endpoints (login, password reset, OTP) — CE will not flag this on its own
- ✅ **Password hashing** (bcrypt, never reversible); generic error messages on auth failures (no user enumeration)
- ✅ **Supply chain (A03:2025):** new/updated dependencies audited (`npm audit`), no unpinned or unmaintained packages introduced
- ✅ **Security misconfiguration (A02:2025):** no debug/verbose mode, stack traces, or internal error detail reaching production responses
- ✅ **Exceptional conditions (A10:2025):** error/failure paths fail closed, not open (e.g. an auth check that errors must deny, not allow, access)

See `CLAUDE.md` → Code Review Standards for the condensed version `/ce-code-review` actually applies; keep both in sync.

---

## 📋 CODE REVIEW GATE

**PASS Criteria:**
- ✅ No hardcoded secrets
- ✅ SOLID principles followed
- ✅ No DRY violations
- ✅ Tests exist and pass
- ✅ Security checklist complete
- ✅ Error handling present
- ✅ Documentation updated

**FAIL Criteria:**
- ❌ Security vulnerabilities detected
- ❌ Tests missing or failing
- ❌ Test coverage drops below target
- ❌ Breaking changes undocumented
- ❌ No validation on user input

---

## 📊 CODE QUALITY CHECKLIST

### Readability
- ✅ Meaningful names (variables, functions, classes)
- ✅ Comments explain WHY, not WHAT
- ✅ No callback hell (async/await or promises)
- ✅ Functions extracted when they do more than one thing or their size interferes with reading the file (no fixed line count — see CLAUDE.md)
- ✅ Consistent formatting
- ✅ TypeScript strict mode

### Performance
- ✅ No N+1 queries
- ✅ Database indexes on frequently filtered columns
- ✅ Memoization for expensive calculations
- ✅ Lazy loading for large lists
- ✅ No memory leaks (cleanup effects, unsubscribe)

### Error Handling
- ✅ Try-catch on async operations
- ✅ Meaningful error messages
- ✅ Error codes for programmatic handling
- ✅ Logging at appropriate levels
- ✅ No silent failures
- ✅ Retry logic for transient failures

### Data & State
- ✅ Single source of truth (no duplication)
- ✅ Immutability where appropriate
- ✅ State validated at runtime
- ✅ No shared mutable state

---

## 🧪 TEST REVIEW GATE

CE's `testing-reviewer` persona is explicitly told to ignore aggregate coverage percentages — it flags specific untested branches instead. No coverage-% target is tracked here.

**PASS Criteria:**
- ✅ Happy path + error cases + edge cases covered
- ✅ Specific untested branches that matter (new error paths, lifecycle guards, early returns) are covered
- ✅ Tests independent (no interdependencies)
- ✅ Assertions specific and clear
- ✅ <30s total execution time
- ✅ Descriptive test names

**FAIL Criteria:**
- ❌ Hardcoded timing (sleep/delays)
- ❌ Silent test failures
- ❌ Vague test names
- ❌ Tests that depend on execution order

---

## 🎯 TEST STRUCTURE CHECKLIST

### Unit Tests
- ✅ Happy path tested
- ✅ Error cases tested (validation, not found, unauthorized)
- ✅ Edge cases tested (empty, null, boundaries)
- ✅ External dependencies mocked
- ✅ No hardcoded delays

### Test Names
```typescript
// ❌ WRONG
it('test create', () => {})

// ✅ RIGHT
it('should create expense with correct group when valid data provided', () => {})
it('should throw validation error when amount is negative', () => {})
it('should reject duplicate email without revealing existence', () => {})
```

---

## 📑 API DESIGN STANDARDS

### Endpoints
- ✅ Proper HTTP methods (GET, POST, PATCH, DELETE)
- ✅ Correct status codes (200, 201, 400, 401, 403, 404, 429, 500)
- ✅ Consistent response format (JSON structure)
- ✅ Meaningful error responses (include code + message)

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "Resource created"
}

{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "User-friendly message",
  "details": { ... }
}
```

---

## 🖥️ FRONTEND STANDARDS

### Components
- ✅ Single Responsibility (one purpose)
- ✅ Props documented (types, required)
- ✅ No prop drilling (use Context for deep nesting)
- ✅ Accessibility (ARIA labels, semantic HTML)
- ✅ Responsive (phone, tablet, desktop)
- ✅ Error boundaries for error handling

### Performance
- ✅ Memoization (React.memo, useMemo, useCallback)
- ✅ Code splitting (lazy load routes, modals)
- ✅ Image optimization
- ✅ Bundle size monitored

---

## 🗄️ DATABASE STANDARDS

### Schema
- ✅ Foreign key constraints enforced
- ✅ Unique constraints where needed
- ✅ Timestamps (createdAt, updatedAt, deletedAt if soft-delete)
- ✅ Data validated at schema level

### Queries
- ✅ No N+1 queries
- ✅ Proper indexes on filtered columns
- ✅ Transactions for multi-step operations
- ✅ Migrations versioned and tested

---

## ✅ DEPLOYMENT CHECKLIST

- ✅ Code compiles (no TypeScript errors)
- ✅ All tests pass (backend + frontend)
- ✅ Security checklist complete
- ✅ Code review passed
- ✅ No uncommitted changes
- ✅ Git history clean
- ✅ Mobile testing done (Expo Go)
- ✅ Ready for git tag and push

---

**When in doubt:** Ask "Does this follow SOLID principles and pass the security checklist?" ✨
