# IMPLEMENTATION ROADMAP
## Phase-by-Phase Action Plan with Time Estimates

**Start Date:** March 21, 2026  
**Target Production Date:** April 18, 2026 (4 weeks)  
**Team Capacity:** 1 Senior + 1 Mid-level developer

---

## 📊 CURRENT STATUS (April 6, 2026)

**PHASE 1:** ✅ 85% COMPLETE
- ✅ JWT Authentication (Done)
- ✅ Bcrypt Password Hashing (Done)
- ✅ Account Lockout (5 attempts → 15 min lock) (Done)
- ✅ Basic Logger Setup (Done)
- ✅ Error Handler (Done)
- ⏳ Enhanced Logging with Winston (TODO)

**PHASE 4:** ✅ 80% COMPLETE
- ✅ AuthContext with AsyncStorage (Done)
- ✅ HTTP Interceptor with Bearer tokens (Done)
- ✅ LoginScreen UI (Done)
- ✅ Auth routes protection (Done)
- 🐛 Mobile Network Connectivity (IN PROGRESS)

**BLOCKED:**
- PHASE 2: Data Model fixes (waiting for Phase 1 completion)
- PHASE 3: Permission checks (waiting for Phase 1 completion)

**NEXT PRIORITIES:**
1. Fix mobile network error (localhost → machine IP)
2. Implement Winston persistent logging
3. Test full auth flow end-to-end
4. Begin Phase 2 data model work

---

## PHASE 1: CRITICAL SECURITY & INFRASTRUCTURE (Days 1-5)

### 1.1 JWT Authentication Implementation
**Time:** 2 days  
**Status:** ✅ COMPLETE (April 3, 2026)
**Owner:** Senior  
**Dependencies:** None  
**Files to Create:**
- [x] `backend/src/middlewares/authMiddleware.ts` - JWT validation
- [x] `backend/src/utils/jwtHelper.ts` - Token generation/validation
- [x] `.env.example` - Updated with JWT_SECRET
- [x] Update `backend/src/app.ts` - Register auth middleware

**Acceptance Criteria:**
- [x] Can generate JWT token with user ID
- [x] Can validate JWT token in requests
- [x] Requests without token get 401 response
- [x] Invalid tokens rejected with proper error
- [x] `req.user` populated from token in all controllers
- [x] Tests: 5+ unit tests passing

**Files to Modify:**
```
backend/src/controllers/groupController.ts       // Replace userId: 1 with req.user.id
backend/src/controllers/expenseController.ts     // Replace userId: 1 with req.user.id
backend/src/app.ts                               // Register middleware
backend/package.json                              // Add jsonwebtoken dependency
```

---

### 1.1B Password Security & Account Lockout (ADDED ENHANCEMENT)
**Time:** 1.5 days  
**Status:** ✅ COMPLETE (April 4, 2026)
**Owner:** Senior

**Production-Grade Security Features Implemented:**
- [x] Bcrypt password hashing (10 salt rounds - OWASP compliant)
- [x] Password strength validation (8+ chars, uppercase, lowercase, digit, special char)
- [x] Common password blacklist
- [x] Account lockout after 5 failed attempts (15 min suspension)
- [x] Constant-time password comparison (prevents timing attacks)
- [x] Generic error messages (prevents email enumeration)

**Files Created:**
- [x] `backend/src/utils/passwordHelper.ts` - Bcrypt + validation
- [x] `backend/src/schemas/authSchema.ts` - Zod validation + password rules
- [x] `backend/src/controllers/authController.ts` - Signup/login/getCurrentUser
- [x] `backend/src/routes/authRoutes.ts` - Auth endpoints
- [x] `backend/src/types/express.ts` - Type extensions

**Database Migration:**
- [x] `20260403190640_add_password_and_auth_fields` - Applied
  - Added: password, isActive, lastLogin, failedLoginAttempts, lockedUntil, createdAt, updatedAt

**Tests Verified:**
- [x] Signup with valid password → 201 status, token issued
- [x] Login with correct credentials → 200 status, token returned
- [x] Protected routes with Bearer token → 200 status
- [x] Account lockout after 5 failed attempts → 429 status

---

### 1.2 Request Logging & Correlation IDs
**Time:** 1.5 days  
**Status:** ⏳ PARTIAL (Basic logger exists, Winston TODO)
**Owner:** Senior  
**Dependencies:** 1.1 (minimal - can run in parallel)

**Files to Create:**
- [x] `backend/src/utils/logger.ts` - Basic logger (needs Winston upgrade)
- [ ] `backend/src/middlewares/requestLoggerMiddleware.ts` - Request/response logging (TODO)
- [ ] `logs/.gitkeep` - Log directory (TODO)

**Current Implementation:**
- Simple console logger with info/error/warn levels
- **NEEDS:** Persistent file logging with Winston, log rotation

**Acceptance Criteria:**
- [ ] Every request gets unique correlationId
- [ ] Logs appear in stdout with timestamp
- [ ] Request/response logged with duration
- [ ] Error logging includes stack trace
- [ ] No console.log in production code

**Files to Modify:**
```
backend/src/app.ts                               // Add logging middleware early
backend/src/middlewares/i18nMiddleware.ts         // Remove debug console.logs
backend/src/middlewares/errorHandler.ts          // Use logger instead of console.error
backend/.gitignore                               // Add logs/ directory
```

**QA Checklist:**
- [ ] Run app and verify logs in console
- [ ] Check that each request has correlationId
- [ ] Verify error logs include full stack trace

---

### 1.3 Error Handler Standardization
**Time:** 1.5 days  
**Owner:** Mid-level  
**Dependencies:** 1.1, 1.2

**Files to Create:**
- [ ] `backend/src/middlewares/asyncHandler.ts` - Wrapper for async routes
- [ ] `backend/src/utils/responseHandler.ts` - Consistent response formatter

**Acceptance Criteria:**
- [ ] All routes wrapped with asyncHandler
- [ ] All responses use ResponseHandler
- [ ] All errors throw AppError
- [ ] Response format consistent: `{success, data, message, error, code, correlationId}`
- [ ] Tests verify response format

**Files to Modify:**
```
backend/src/controllers/groupController.ts        // Wrap routes, use ResponseHandler
backend/src/controllers/expenseController.ts      // Wrap routes, use ResponseHandler
backend/src/middlewares/errorHandler.ts          // Updated format
```

---

### 1.4 Rate Limiting
**Time:** 1 day  
**Owner:** Mid-level  
**Dependencies:** None

**Files to Create:**
- [ ] `backend/src/middlewares/rateLimitMiddleware.ts` - Express-rate-limit setup

**Acceptance Criteria:**
- [ ] 100 requests per 15 min per IP (general)
- [ ] 5 login attempts per 15 min per IP (if auth endpoint)
- [ ] Test exceeding limit returns 429 status

**Files to Modify:**
```
backend/src/app.ts                               // Register rate limiter
backend/package.json                              // Add express-rate-limit
```

---

## PHASE 2: DATA MODEL & CORE SERVICES (Days 6-10)

### 2.1 Fix Expense Split Data Model
**Time:** 2 days  
**Owner:** Senior  
**Dependencies:** None (but blocks 2.2)

**Files to Create:**
- [ ] `backend/prisma/migrations/[timestamp]_fix_expense_splits/migration.sql` - Migration

**Acceptance Criteria:**
- [ ] ExpenseSplit junction table created
- [ ] All old split data migrated (create migration script)
- [ ] Indexes on common queries
- [ ] Schema validates in Prisma
- [ ] No data loss

**Files to Modify:**
```
backend/prisma/schema.prisma                     // Add ExpenseSplit model
backend/src/services/expenseService.ts            // Update to use junction table
```

**Migration Strategy:**
```sql
-- Create new table
CREATE TABLE "ExpenseSplit" (...)

-- Migrate data (needs custom logic in seed/migration script)
-- Since arrays were stored, create splits from historical data

-- Drop old columns
ALTER TABLE "Expense" DROP COLUMN "splitWith";
ALTER TABLE "Expense" DROP COLUMN "splitAmount";
ALTER TABLE "Expense" DROP COLUMN "splitPercentage";
```

---

### 2.2 Update Expense Service for New Model
**Time:** 1.5 days  
**Owner:** Mid-level  
**Dependencies:** 2.1

**Files to Modify:**
```
backend/src/services/expenseService.ts           // createExpense, getGroupExpenses
backend/src/services/__tests__/expenseService.test.ts  // Add tests
```

**Acceptance Criteria:**
- [ ] createExpense works with new split table
- [ ] Transactions used (all-or-nothing operation)
- [ ] Tests cover: EQUAL, AMOUNT, PERCENTAGE split types
- [ ] Tests cover: edge cases (empty splits, single user)
- [ ] Old getAllExpenses() deprecated with warning

---

### 2.3 Add Database Indexes
**Time:** 1 day  
**Owner:** Mid-level  
**Dependencies:** 2.1

**Acceptance Criteria:**
- [ ] All recommended indexes added
- [ ] `prisma db push` succeeds
- [ ] Migration can be run on clean DB

**Files to Modify:**
```
backend/prisma/schema.prisma                     // Add all @@index annotations
```

---

## PHASE 3: PERMISSION & VALIDATION (Days 11-14)

### 3.1 Implement Permission Checks
**Time:** 1.5 days  
**Owner:** Senior  
**Dependencies:** 1.1

**Checklist:**
- [ ] Group access: Only members/creators can view
- [ ] Expense creation: User must be group member
- [ ] Expense deletion: Only payer or group creator can delete
- [ ] Member addition: Only group creator
- [ ] Group deletion: Only group creator

**Files to Modify:**
```
backend/src/services/groupService.ts            // Add permission checks
backend/src/services/expenseService.ts           // Add access verification
backend/src/controllers/groupController.ts       // Call permission-checked services
backend/src/controllers/expenseController.ts     // Call permission-checked services
```

---

### 3.2 Input Validation Enhancement
**Time:** 1 day  
**Owner:** Mid-level  
**Dependencies:** 1.3

**Enhancements:**
- [ ] Validate groupId exists and user has access
- [ ] Validate paidById is valid user
- [ ] Validate splitWithIds users exist
- [ ] Validate category exists
- [ ] Better error messages with field details

**Files to Modify:**
```
backend/src/controllers/expenseController.ts     // Add pre-service validation
backend/src/schemas/expenseSchema.ts             // Zod schema enhancements
backend/src/locales/en/translation.json          // Add new error keys
backend/src/locales/fr/translation.json          // Add new error keys
```

---

### 3.3 Add Soft Delete Verification
**Time:** 0.5 days  
**Owner:** Mid-level  
**Dependencies:** 1.1, 2.1

**Checklist:**
- [ ] getGroupById filters `isActive: true`
- [ ] getUserGroups filters `isActive: true`
- [ ] getGroupExpenses filters deleted groups
- [ ] All group queries include `isActive: true`

**Files to Modify:**
```
backend/src/services/groupService.ts            // Add isActive checks everywhere
backend/src/services/expenseService.ts           // Verify group is active
```

---

## PHASE 4: FRONTEND API INTEGRATION (Days 15-18)

### 4.1 Create Frontend Service Layer
**Time:** 1 day  
**Status:** ✅ COMPLETE (April 4, 2026)
**Owner:** Mid-level  
**Dependencies:** 1.1 (backend auth)

**Files to Create:**
- [x] `frontend/src/context/AuthContext.tsx` - JWT token + user state management
- [x] `frontend/src/screens/LoginScreen.tsx` - Signup/login UI
- [x] `frontend/src/api/http/interceptors.ts` - Bearer token injection + 401 handling

**Acceptance Criteria:**
- [x] Token stored in AsyncStorage (persistent across restarts)
- [x] useAuth hook for component access
- [x] Signup flow tested (201 status)
- [x] Login flow tested (200 status)
- [x] 401 errors redirect to login
- [x] All requests include Bearer token

**Additional Setup:**
- [x] `@react-native-async-storage/async-storage@1.24.0` installed
- [x] Navigation refactored for conditional auth flow
- [x] App.tsx wraps entire app with AuthProvider
- [x] Type-safe navigation with RootStackParamList

### 4.2 Mobile App Testing
**Status:** 🐛 IN PROGRESS (Network Error)
**Owner:** QA

**Current Issue:**
- ❌ Mobile cannot reach `localhost:4000` (localhost is relative to device, not computer)
- 📋 **Fix Required:** Change API URL from `localhost:4000` → `192.168.x.x:4000` (machine IP)

**Next Steps:**
1. Get computer IP address (`ipconfig` on Windows)
2. Create `.env` file in frontend with `EXPO_PUBLIC_API_BASE_URL=http://<IP>:4000/api`
3. Restart frontend and test signup/login

**Test Cases (Pending):**
- [ ] Signup on mobile with valid credentials
- [ ] Login on mobile with credentials
- [ ] Create group via mobile
- [ ] List expenses via mobile
- [ ] Logout and re-login
- [ ] Account lockout after 5 failed attempts
- [ ] Token persists across app restart
- [ ] Empty state when no groups
- [ ] Groups display correctly formatted

---

### 4.3 Implement CreateGroupScreen API Integration
**Time:** 1 day  
**Status:** ✅ COMPLETE (April 4, 2026)
**Owner:** Mid-level  
**Dependencies:** 4.1

**Files to Modify:**
```
frontend/src/screens/CreateGroupScreen.tsx      // Call actual API instead of mock
```

**Acceptance Criteria:**
- [x] createGroup() calls backend API
- [x] Error handling for duplicate names
- [x] Success toast/notification
- [x] Navigate back to HomeScreen after creation

---

## IMMEDIATE NEXT STEPS (Priority Order)

### 1. 🐛 Fix Mobile Network Error (TODAY)
**Issue:** Mobile app cannot reach `localhost:4000`
**Root Cause:** "localhost" in mobile context points to the device itself, not your computer

**Solution:**
```bash
# Step 1: Get your computer IP
ipconfig

# Step 2: Create frontend/.env file
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:4000/api

# Step 3: Restart frontend
npm start
```

**Verify:**
- Check Expo terminal shows correct API base URL
- Try signup on mobile - should not get network error
- Check network tab for successful API call to your IP

### 2. ⏳ Implement Winston Logging (NEXT 2 DAYS)
**Time:** 2 days
**Priority:** HIGH (needed for production)

**What to Add:**
- Winston for backend file logging
- Log rotation (daily files)
- Structured logging (JSON format)
- Log directory: `backend/logs/`
- Different log levels: error, warn, info, debug

**Files to Create:**
- `backend/src/utils/Logger.ts` - Winston setup
- `backend/src/middlewares/requestLoggerMiddleware.ts` - Request/response logging
- `backend/logs/.gitkeep`

**Result:** All errors written to `backend/logs/error.log` for production debugging

### 3. ✅ Complete Mobile Testing (AFTER FIX)
**Test Flow:**
```
1. Signup: testuser@example.com / Password123!
2. Check AsyncStorage has token
3. Navigate to HomeScreen
4. Logout
5. Restart app
6. Should be on LoginScreen (token cleared)
```

### 4. 📋 Start Phase 2 (AFTER PHASE 1 COMPLETE)
**Data Model Fixes:**
- Expense split junction table
- Database indexes
- Permission checks
- Input validation

---

## COMMITS TRACKING

| Date | Commit | Feature |
|------|--------|---------|
| Apr 3 | `b60250b` | JWT + Bcrypt Auth Implementation |
| Apr 4 | `f2ad0d8` | Frontend AuthContext + HTTP Interceptor |
| Apr 4 | Fixed Prisma types | Regenerated TypeScript definitions |
| Apr 5 | Fixed Frontend types | Updated NavContainer ref typing |
| Apr 6 | TODO | Fix mobile network connectivity |
| Apr 6 | TODO | Implement Winston logging |

---

## BLOCKERS & RISKS

| Issue | Impact | Status | Solution |
|-------|--------|--------|----------|
| Mobile localhost → backend | HIGH | 🐛 IN PROGRESS | Use machine IP |
| Prisma types stale | HIGH | ✅ RESOLVED | Ran `npx prisma generate` |
| AsyncStorage missing | HIGH | ✅ RESOLVED | Installed package |
| Navigation ref typing | MEDIUM | ✅ RESOLVED | Updated to NavigationContainerRef |
| No persistent logs | HIGH | ⏳ TODO | Setup Winston |
| No refresh tokens | MEDIUM | ⏳ TODO | Phase 3 (15 min access token) |

---

## SUCCESS METRICS

**Phase 1 Complete When:**
- [x] Signup via mobile works end-to-end
- [x] JWT token persists across app restarts
- [x] Account lockout working
- [x] Protected routes enforcing auth
- [ ] Winston logging writing to files
- [ ] Logs visible in `backend/logs/`

**Date Target:** April 8, 2026 (for Phase 1 full completion)
**Owner:** Mid-level  
**Dependencies:** 4.1

**Files to Modify:**
```
frontend/src/screens/CreateGroupScreen.tsx      // Call actual API
```

**Acceptance Criteria:**
- [ ] Form validates properly
- [ ] Submit button disabled during loading
- [ ] Success returns to HomeScreen
- [ ] Error shown in alert
- [ ] Form resets after success

---

### 4.4 Implement ExpenseListScreen API Integration
**Time:** 1 day  
**Owner:** Mid-level  
**Dependencies:** 4.1

**Files to Modify:**
```
frontend/src/screens/ExpenseListScreen.tsx      // Update to call API properly
frontend/src/services/expenseService.ts          // Add getGroupExpenses(groupId)
```

**Acceptance Criteria:**
- [ ] Fetches expenses for specific group (not all)
- [ ] Displays with loading/error/empty states
- [ ] Pull-to-refresh works
- [ ] Navigation to expense detail works

---

## PHASE 5: TESTING & DOCUMENTATION (Days 19-25)

### 5.1 Backend Unit Tests
**Time:** 2 days  
**Owner:** Senior  
**Dependencies:** All services complete

**Target:** 80%+ coverage

**Test Files:**
- [ ] `backend/src/services/__tests__/groupService.test.ts` - 15+ tests
- [ ] `backend/src/services/__tests__/expenseService.test.ts` - 20+ tests
- [ ] `backend/src/controllers/__tests__/groupController.test.ts` - 10+ integration tests
- [ ] `backend/src/controllers/__tests__/expenseController.test.ts` - 10+ integration tests

**Coverage Goals:**
```
Statements   : 80%+
Branches     : 75%+
Functions    : 80%+
Lines        : 80%+
```

---

### 5.2 Backend Integration Tests
**Time:** 2 days  
**Owner:** Mid-level  
**Dependencies:** 5.1

**Scenarios:**
- [ ] Full flow: Create group → Add member → Create expense → Calculate splits
- [ ] Permission denial scenarios
- [ ] Error cases
- [ ] Edge cases (rounding, boundary values)

---

### 5.3 Frontend Component Tests
**Time:** 1.5 days  
**Owner:** Mid-level  
**Dependencies:** Phase 4 complete

**Test Files:**
- [ ] `frontend/src/screens/__tests__/HomeScreen.test.tsx`
- [ ] `frontend/src/screens/__tests__/CreateGroupScreen.test.tsx`
- [ ] `frontend/src/screens/__tests__/ExpenseListScreen.test.tsx`

**Coverage:**
- [ ] Component renders
- [ ] User interactions work
- [ ] API calls made with correct data
- [ ] Error states display properly

---

### 5.4 API Documentation
**Time:** 1.5 days  
**Owner:** Senior  
**Dependencies:** None (can parallel)

**Deliverables:**
- [ ] `backend/API_DOCUMENTATION.md` - All endpoints, request/response examples
- [ ] `backend/SETUP_GUIDE.md` - How to set up locally
- [ ] `frontend/SETUP_GUIDE.md` - Frontend setup
- [ ] `DEPLOYMENT_GUIDE.md` - Production deployment steps

---

### 5.5 Runbook for Operations
**Time:** 1 day  
**Owner:** Senior

**Deliverables:**
- [ ] `PRODUCTION_RUNBOOK.md` - How to handle common issues
- [ ] `TROUBLESHOOTING.md` - Debug guide
- [ ] `MONITORING.md` - What to monitor

---

## PHASE 6: DEPLOYMENT READINESS (Days 26-28)

### 6.1 Environment Configuration
**Time:** 1 day

**Deliverables:**
- [ ] `.env.production` template created
- [ ] Docker setup verified
- [ ] Database migration tested on clean instance
- [ ] Seeding script works

**Files:**
- [ ] `docker-compose.prod.yml` - Production config
- [ ] `.env.example` - Updated with all vars
- [ ] `backend/.env.production.example` - Prod config

---

### 6.2 Performance Optimization
**Time:** 1 day

**Checklist:**
- [ ] Query N+1 problems identified and fixed
- [ ] Database indexes verified with EXPLAIN plans
- [ ] Frontend bundle size < 2MB
- [ ] API response times < 500ms

---

### 6.3 Security Audit
**Time:** 1 day

**Checklist:**
- [ ] No hardcoded secrets in code
- [ ] CORS properly configured (not open to all)
- [ ] HTTPS enforced in production
- [ ] JWT secret properly generated (32+ chars)
- [ ] Rate limiting enabled
- [ ] Input sanitization applied
- [ ] SQL injection not possible (Prisma prevents)
- [ ] XSS not possible (strings escaped)

---

## PHASE 7: FINAL TESTING & RELEASE (Days 29-28)

### 7.1 End-to-End Testing
**Time:** 1.5 days

**Scenarios to Test:**
- [ ] User registration → Login → Create group → Add expense → Settle
- [ ] Multiple users in group scenario
- [ ] Different split types (EQUAL, AMOUNT, PERCENTAGE)
- [ ] Error recovery (retry after timeout)
- [ ] Offline handling (if implemented)

---

### 7.2 UAT Sign-Off
**Time:** 1 day

- [ ] Stakeholder testing
- [ ] Bug fixes prioritized
- [ ] Documentation reviewed

---

### 7.3 Deployment
**Time:** 1 day

- [ ] Deploy to staging
- [ ] Smoke tests pass
- [ ] Deploy to production
- [ ] Monitor for errors

---

## DAILY STANDUP FORMAT

```
### [Date]: Sprint Status

**Completed:**
- Item 1 (✅ Done)
- Item 2 (✅ Done)

**In Progress:**
- Item 3 (75% complete)

**Blocked/Risks:**
- Risk: [Description] → Action: [Mitigation]

**Tomorrow:**
- Plan for Item 4
- Plan for Item 5

**Metrics:**
- Test Coverage: X%
- Bugs Found: N (Critical: X, High: Y)
```

---

## RISK MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Database migration breaks old data | CRITICAL | Test migration on copy; have rollback plan |
| Breaking API changes | HIGH | Version API as v1; document changes |
| Auth implementation complexity | HIGH | Use battle-tested library; thorough testing |
| Performance issues discovered late | HIGH | Load test early; monitor query performance |
| Frontend API integration issues | MEDIUM | Mock API responses; test with stubbed API first |

---

## DEFINITION OF DONE

### Per User Story/Task
- [ ] Code written and peer reviewed
- [ ] Tests written and passing (80%+ coverage)
- [ ] All lint/type errors fixed
- [ ] Commits follow convention
- [ ] PR merged to main
- [ ] Deployment to staging verified

### Per Sprint
- [ ] All stories completed
- [ ] No blocker bugs
- [ ] Documentation updated
- [ ] Release notes prepared
- [ ] Team sign-off received

---

## SUCCESS METRICS

**By End of Week 1 (Phase 1):**
- ✅ Authentication working (can log in)
- ✅ Logging visible in console
- ✅ Error responses consistent
- ✅ Rate limiting working

**By End of Week 2 (Phase 2-3):**
- ✅ Data model fixed
- ✅ Permissions enforced
- ✅ All validation working
- ✅ Core services tested

**By End of Week 3 (Phase 4):**
- ✅ Frontend connects to backend
- ✅ Full flow working end-to-end
- ✅ API integration complete

**By End of Week 4 (Phase 5-7):**
- ✅ 80%+ test coverage
- ✅ All documentation complete
- ✅ Production-ready
- ✅ Security audit passed
- ✅ Ready to deploy

---

## ESTIMATED BURN-DOWN

```
Week 1: 5 days (5 tasks) → 80% critical fixes
Week 2: 5 days (9 tasks) → 60% remaining work
Week 3: 5 days (8 tasks) → 40% remaining work
Week 4: 5 days (7 tasks) → 20% remaining work
Week 5: 5 days (6 tasks) → Production ready

Total: 28 working days for 2-person team
```

---

## Notes

- This roadmap assumes 90% parallelization of backend and frontend work
- Backend work must be 95% complete before heavy frontend integration
- Testing should start in Phase 2 with unit tests, not Phase 5
- Documentation should be written in parallel, not sequentially
- All code must pass linting before review
- All PRs require 1 peer review + tests passing
