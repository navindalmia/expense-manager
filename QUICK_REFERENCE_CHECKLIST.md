# QUICK REFERENCE: PRE-PRODUCTION CHECKLIST
## Use this during implementation to track progress

---

## PHASE 1: SECURITY (Days 1-5)

### Authentication Setup
```
[ ] Install jsonwebtoken & types
[ ] Create authMiddleware.ts
[ ] Create jwtHelper.ts (sign, verify)
[ ] Update app.ts to use authMiddleware
[ ] Replace all userId: 1 with req.user.id
[ ] Add JWT_SECRET to .env
[ ] Write 5+ auth tests
[ ] Test: Can create and validate JWT
[ ] Test: Invalid token returns 401
```

### Request Logging
```
[ ] Install winston
[ ] Create logger.ts
[ ] Create requestLoggerMiddleware.ts
[ ] Add correlationId to all requests
[ ] Register middleware in app.ts
[ ] Remove debug console.logs from i18nMiddleware
[ ] Update errorHandler to use logger
[ ] Test: Logs appear in stdout
[ ] Test: Each request has correlationId
```

### Error Handling Standardization
```
[ ] Create asyncHandler.ts wrapper
[ ] Create responseHandler.ts
[ ] Update all controllers to use asyncHandler
[ ] Update all controllers to use ResponseHandler
[ ] Test: Response format consistent
[ ] Test: Errors caught by errorHandler
```

### Rate Limiting
```
[ ] Install express-rate-limit
[ ] Create rateLimitMiddleware.ts
[ ] Register in app.ts
[ ] Set 100 req/15min for general API
[ ] Set 5 req/15min for auth
[ ] Test: 429 status when limit exceeded
```

---

## PHASE 2: DATA MODEL (Days 6-10)

### Expense Split Refactor
```
[ ] Create migration for ExpenseSplit table
[ ] Add ExpenseSplit model to schema.prisma
[ ] Remove splitAmount[] and splitPercentage[] from Expense
[ ] Add splits relationship to Expense
[ ] Add expensesSplit relationship to User
[ ] Create migration script to move data
[ ] Run migration on dev DB
[ ] Test: Migration completes without errors
[ ] Update expenseService.createExpense()
[ ] Update expenseService.getGroupExpenses()
[ ] Verify transactional behavior
[ ] Write tests for new model
```

### Database Indexes
```
[ ] Add index on isSettled
[ ] Add composite index (groupId, isSettled)
[ ] Add composite index (groupId, isSettled, expenseDate)
[ ] Add index on categoryId
[ ] Add index on createdAt (User, Expense)
[ ] Add composite index (isActive, createdById) on Group
[ ] Run: prisma db push
[ ] Verify in database: SELECT * FROM pg_indexes
```

---

## PHASE 3: PERMISSIONS & VALIDATION (Days 11-14)

### Permission Checks - Groups
```
[ ] getGroupById: Verify user is member or creator
[ ] getUserGroups: Filter only user's groups
[ ] addMemberToGroup: Only creator can add
[ ] deactivateGroup: Only creator can delete
[ ] Write tests for each permission scenario
[ ] Test: Non-member gets 403 on access
[ ] Test: Non-creator can't add members
```

### Permission Checks - Expenses
```
[ ] getGroupExpenses: Verify user is group member
[ ] createExpense: Verify user is group member
[ ] deleteExpense: Only payer or creator can delete
[ ] Write tests for each scenario
[ ] Test: Non-payer gets 403 on delete
```

### Validation Enhancement
```
[ ] Add groupId existence check
[ ] Add paidById validation
[ ] Add splitWithIds validation
[ ] Add categoryId validation
[ ] Add memberId validation in addMember
[ ] Update error messages with field details
[ ] Add translation keys for new errors
[ ] Test: Invalid data returns 400 with clear message
```

### Soft Delete Verification
```
[ ] Check getGroupById has isActive: true filter
[ ] Check getUserGroups has isActive: true filter
[ ] Check getGroupExpenses filters active groups
[ ] Check every group.findMany has isActive filter
[ ] Test: Deleted groups don't appear in queries
```

---

## PHASE 4: FRONTEND INTEGRATION (Days 15-18)

### Group Service
```
[ ] Create frontend/src/services/groupService.ts
[ ] Implement getGroups()
[ ] Implement createGroup()
[ ] Implement getGroupStats()
[ ] All functions return proper types
[ ] All functions handle errors
[ ] Test: API calls work with mock data
```

### Auth Service
```
[ ] Create frontend/src/services/authService.ts
[ ] Implement login(email, password) → returns JWT
[ ] Implement logout() → clears token
[ ] Store JWT in AsyncStorage
[ ] Include JWT in all API requests
[ ] Test: Token sent in Authorization header
```

### HomeScreen Integration
```
[ ] Import groupService
[ ] Replace mock getGroups() with real API
[ ] Handle loading state
[ ] Handle error state with retry
[ ] Handle empty state
[ ] Test: Groups load from API
[ ] Test: Pull-to-refresh works
[ ] Test: Error display works
```

### CreateGroupScreen Integration
```
[ ] Import groupService
[ ] Replace mock createGroup() with real API
[ ] Handle loading state (disable submit button)
[ ] Handle success (navigate to group)
[ ] Handle error (show alert)
[ ] Test: Form submits to API
[ ] Test: Error shows in alert
[ ] Test: Navigation works
```

### ExpenseListScreen Integration
```
[ ] Update to receive groupId from route
[ ] Import expenseService
[ ] Call getGroupExpenses(groupId)
[ ] Handle loading/error/empty states
[ ] Test: Fetches group's expenses only
[ ] Test: Pull-to-refresh works
```

---

## PHASE 5: TESTING (Days 19-25)

### Backend Unit Tests
```
[ ] groupService tests (15+): create, read, update, delete, permissions
[ ] expenseService tests (20+): create with splits, delete, calculations
[ ] Test happy paths (70% of tests)
[ ] Test error cases (20% of tests)
[ ] Test edge cases (10% of tests)
[ ] Coverage report: 80%+ lines
[ ] All tests passing: npm test ✅
[ ] Run: npm run test:coverage
```

### Backend Integration Tests
```
[ ] Full group creation flow
[ ] Full expense creation with splits
[ ] Permission denial tests
[ ] Multi-user scenarios
[ ] Error recovery tests
[ ] Transaction rollback tests
[ ] At least 10 integration tests
```

### Frontend Component Tests
```
[ ] HomeScreen: render, load groups, handle errors
[ ] CreateGroupScreen: validate form, submit, error
[ ] ExpenseListScreen: load expenses, display, refresh
[ ] At least 3 tests per screen
[ ] Component renders without crashing
[ ] User interactions work
[ ] API calls verified
```

### Manual Test Scenarios
```
[ ] User flow: Login → Create group → Add member → Create expense
[ ] Different split types: EQUAL, AMOUNT, PERCENTAGE
[ ] Error recovery: Retry after timeout
[ ] Concurrent users in same group
[ ] Edge cases: Empty amounts, single user, zero amounts
```

---

## PHASE 6: DOCUMENTATION (Days 19-25, parallel)

### API Documentation
```
[ ] Document POST /api/groups (request/response examples)
[ ] Document GET /api/groups (query params, pagination)
[ ] Document POST /api/expenses (request/response)
[ ] Document GET /api/groups/:id/expenses
[ ] Document DELETE /api/expenses/:id
[ ] Document all error codes
[ ] Include cURL examples
[ ] File: backend/API_DOCUMENTATION.md
```

### Setup Guides
```
[ ] backend/SETUP_GUIDE.md: Installation, migrations, seeding
[ ] frontend/SETUP_GUIDE.md: Installation, config, running
[ ] Include environment variable examples
[ ] Include troubleshooting section
```

### Production Guides
```
[ ] DEPLOYMENT_GUIDE.md: Step-by-step deployment
[ ] PRODUCTION_RUNBOOK.md: Common issues and fixes
[ ] TROUBLESHOOTING.md: Debug guide with logs
[ ] MONITORING.md: What to monitor and alerts
```

---

## PHASE 7: DEPLOYMENT READINESS (Days 26-28)

### Environment Configuration
```
[ ] Create .env.production.example
[ ] All secrets use environment variables
[ ] No secrets in git
[ ] docker-compose.prod.yml created
[ ] Database migration tested on clean DB
[ ] Seed script works
[ ] Test: Fresh docker-compose up produces working app
```

### Performance & Security
```
[ ] Query N+1 problems fixed
[ ] Database indexes verified with EXPLAIN
[ ] Frontend bundle size checked
[ ] API response times < 500ms
[ ] No hardcoded secrets
[ ] CORS properly configured (not open)
[ ] HTTPS enforced (in Prod)
[ ] JWT secret is 32+ random characters
[ ] Rate limiting active
[ ] Input sanitization applied
[ ] Security headers set (X-Content-Type-Options, etc)
```

### Final Checks
```
[ ] All tests passing (100%)
[ ] Zero lint errors
[ ] Zero TypeScript errors
[ ] All PRs merged
[ ] Staging deployment tested
[ ] Smoke tests pass
[ ] Monitoring setup complete
[ ] On-call runbook prepared
```

---

## GIT WORKFLOW

### Branching Strategy
```
main (production-ready)
  └─ staging (pre-production test)
       └─ develop (integration branch)
            ├─ feature/auth-implementation
            ├─ feature/expense-split-refactor
            ├─ feature/permission-checks
            └─ bugfix/[issue-number]
```

### Commit Message Format
```
feat: add JWT authentication middleware
  - Implement jwtMiddleware for request validation
  - Add token generation in authService
  - Update controllers to use req.user
  - Add 8 unit tests
  - Coverage increased from 0% to 15%

fix: exclude deleted groups from queries
  
chore: update dependencies
```

### PR Guidelines
```
[ ] Each PR fixes ONE feature/issue
[ ] PR description includes:
    - What changed and why
    - How to test
    - Any breaking changes
    - Related issue number
[ ] All tests passing
[ ] Linting passes
[ ] At least 1 approval needed
[ ] Coverage not decreased
[ ] Merge only after all checks pass
```

---

## CODE REVIEW CHECKLIST

### For Every PR:
```
[ ] Code is readable and well-commented
[ ] Error handling complete (happy path + errors)
[ ] No console.log/debugger statements
[ ] Tests included and passing
[ ] Types are correct (no any types)
[ ] No hardcoded values (use env vars)
[ ] SQL injection impossible (using ORM)
[ ] XSS not possible (strings are escaped)
[ ] No performance regressions
[ ] API response time acceptable
[ ] Database queries optimized
```

---

## METRICS DASHBOARD

Use these to track progress:

### Code Quality
```
TypeScript Coverage:     __%  (Target: 95%+)
Test Coverage:          __%  (Target: 80%+)
Lint Errors:             __  (Target: 0)
Type Errors:             __  (Target: 0)
```

### Velocity (Team Capacity)
```
Week 1: Complete ___ of 5 critical tasks
Week 2: Complete ___ of 9 tasks
Week 3: Complete ___ of 8 tasks
Week 4: Complete ___ of 7 tasks
```

### Quality Metrics
```
Bugs Found (Testing):    __
Bugs Found (UAT):        __
Critical Fixes Needed:   __
Deployment Ready:        [ ] YES  [ ] NO
```

---

## STATUS REPORT TEMPLATE

**Date:** ___________

**This Week:**
- ✅ Completed: _________________________________
- 🔄 In Progress: _______________________________
- ⏸️ Blocked: ________________________________

**Key Metrics:**
- Test Coverage: ___%
- Code Review Cycle: __ hours
- Bugs Created: __ | Bugs Fixed: __

**Next Week:**
- Plan: _________________________________
- Risks: ________________________________

---

## COMMON GOTCHAS & HOW TO FIX

### "Can't generate JWT"
```typescript
// ❌ WRONG:
const secret = 'password'; // Too short!

// ✅ RIGHT:
const secret = process.env.JWT_SECRET; // 32+ chars from env
```

### "Migrations fail on production"
```
- Always test migration on copy of production DB
- Test rollback before deploying
- Have rollback script ready
- Test fresh DB creation with all migrations
```

### "N+1 queries killing performance"
```typescript
// ❌ WRONG:
const expenses = await prisma.expense.findMany();
expenses.forEach(exp => {
  exp.paidBy = await prisma.user.findUnique(...); // 1 + N queries
});

// ✅ RIGHT:
const expenses = await prisma.expense.findMany({
  include: { paidBy: true } // 1 query
});
```

### "Frontend can't reach backend API"
```
- Check EXPO_PUBLIC_API_BASE_URL in .env
- Check CORS settings in backend
- Check both are using same port
- Test with curl:
  curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/groups
```

### "Auth middleware not working"
```typescript
// ❌ WRONG:
app.use('/api', routes);      // Routes first
app.use(authMiddleware);      // Auth after - too late!

// ✅ RIGHT:
app.use(authMiddleware);      // Auth first
app.use('/api', routes);      // Routes after
```

---

## FINAL SIGN-OFF CHECKLIST

Before marking as "Production Ready":

```
SECURITY
[ ] No hardcoded secrets
[ ] JWT implemented and working
[ ] Rate limiting active
[ ] CORS configured properly
[ ] SQL injection impossible
[ ] XSS not possible
[ ] All user inputs validated
[ ] Permissions enforced

DATA INTEGRITY
[ ] Database migrations tested
[ ] Soft deletes working
[ ] Cascading deletes correct
[ ] Transactions for complex ops
[ ] Indexes created and verified
[ ] No N+1 queries

TESTING
[ ] 80%+ test coverage
[ ] Integration tests passing
[ ] E2E scenarios tested
[ ] Error scenarios tested
[ ] Performance benchmarks met

OPERATIONS
[ ] Logging working correctly
[ ] Errors traced with correlationId
[ ] Monitoring setup
[ ] Runbook prepared
[ ] Deployment procedure documented
[ ] Rollback procedure tested

QUALITY
[ ] Zero lint errors
[ ] Zero type errors
[ ] All PRs reviewed
[ ] Documentation complete
[ ] Code clean and readable

FINAL CHECK
[ ] Can deploy without downtime
[ ] Can rollback if needed
[ ] Team trained on systems
[ ] Stakeholders sign-off obtained
[ ] Ready for production ✅
```

---

**IMPORTANT: Print this checklist and check off items as you go. It's the team's source of truth.**
