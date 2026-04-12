# Quality Standards & Review Gates

**For code reviews, security checks, and architectural decisions**

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

## 🔒 SECURITY CHECKLIST (OWASP)

### Input & Authentication
- ✅ **No hardcoded secrets** (API keys, tokens, passwords)
- ✅ **Server-side validation** (never trust client)
- ✅ **Authentication enforced** on protected endpoints
- ✅ **Authorization checks** (user in group? owns expense?)
- ✅ **No user enumeration** (generic error messages for auth failures)
- ✅ **Password hashing** (bcrypt, never reversible)

### API Security
- ✅ **SQL Injection prevented** (use ORM, parameterized queries)
- ✅ **XSS protected** (escape output, don't trust input)
- ✅ **CSRF tokens** for state-changing operations
- ✅ **Rate limiting** for brute force prevention
- ✅ **CORS configured** correctly
- ✅ **No plaintext passwords** in logs or responses

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
- ✅ Functions <50 lines
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

**PASS Criteria:**
- ✅ Coverage >80% for auth/security
- ✅ All edge cases covered
- ✅ Tests independent (no interdependencies)
- ✅ Assertions specific and clear
- ✅ <30s total execution time
- ✅ Descriptive test names

**FAIL Criteria:**
- ❌ Coverage <70%
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
