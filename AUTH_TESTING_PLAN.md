# Authentication & Security Testing Plan

**Date Created:** April 11, 2026  
**Status:** Ready for Implementation  
**Priority:** Phase 1 (Critical)

---

## Executive Summary

The Expense Manager project has a **complete backend authentication system** but **ZERO automated auth tests**. This document outlines all required tests across backend, frontend, and security domains.

### Current State Analysis
- ✅ Backend: Full JWT auth, password hashing, account lockout
- ✅ Frontend: AuthContext with login/signup flows
- ❌ Backend Tests: **0 auth tests** (only expenseService.test.ts exists, disabled)
- ❌ Frontend Tests: **0 auth tests** (only expenseListScreen.test.tsx, minimal coverage)
- ❌ Security Tests: **0 vulnerability tests**

---

## BACKEND API TESTS NEEDED

### 1. Signup Endpoint (`POST /api/auth/signup`)

#### Happy Path
- [ ] **Valid signup with all fields**
  - Input: Valid email, strong password, name
  - Expected: 201, token returned, user created
  - Verify: User in database, password hashed (bcrypt), token valid

- [ ] **Valid signup normalizes email to lowercase**
  - Input: Email with uppercase letters
  - Expected: Email stored as lowercase

#### Input Validation
- [ ] **Rejects empty email**
  - Input: `{ password: "Test@123", name: "John" }`
  - Expected: 400, `VALIDATION_ERROR`, message includes "Email is required"

- [ ] **Rejects invalid email format**
  - Input: `{ email: "notanemail", password: "Test@123", name: "John" }`
  - Expected: 400, `VALIDATION_ERROR`

- [ ] **Rejects email with double dots**
  - Input: `{ email: "user..name@example.com", password: "Test@123", name: "John" }`
  - Expected: 400, `VALIDATION_ERROR`

- [ ] **Rejects password < 8 characters**
  - Input: `{ email: "user@test.com", password: "Pass@1", name: "John" }`
  - Expected: 400, includes "at least 8 characters"

- [ ] **Rejects password without uppercase**
  - Input: `{ email: "user@test.com", password: "password@123", name: "John" }`
  - Expected: 400, includes "uppercase letter"

- [ ] **Rejects password without lowercase**
  - Input: `{ email: "user@test.com", password: "PASSWORD@123", name: "John" }`
  - Expected: 400, includes "lowercase letter"

- [ ] **Rejects password without number**
  - Input: `{ email: "user@test.com", password: "Password@abc", name: "John" }`
  - Expected: 400, includes "number"

- [ ] **Rejects password without special character**
  - Input: `{ email: "user@test.com", password: "Password123", name: "John" }`
  - Expected: 400, includes "special character"

- [ ] **Rejects common passwords**
  - Input: Password like "password123", "admin123", "12345678"
  - Expected: 400, "too common"

- [ ] **Rejects name < 2 characters**
  - Input: `{ email: "user@test.com", password: "Test@123", name: "A" }`
  - Expected: 400, "at least 2 characters"

- [ ] **Rejects name > 100 characters**
  - Input: Name with 101+ characters
  - Expected: 400, "less than 100 characters"

- [ ] **Rejects invalid name characters**
  - Input: `{ name: "John@123" }` (contains numbers and @)
  - Expected: 400, only letters, spaces, hyphens, apostrophes allowed

#### Duplicate Email
- [ ] **Rejects duplicate email (user-friendly error)**
  - Setup: Create user with email "john@test.com"
  - Input: Try signup with same email
  - Expected: 409, generic error message (don't reveal email exists for security)
  - Security: Response doesn't leak whether email is registered

#### Edge Cases
- [ ] **Name with apostrophes allowed**
  - Input: `{ name: "O'Brien" }`
  - Expected: 201, succeeds

- [ ] **Name with hyphens allowed**
  - Input: `{ name: "Anne-Marie" }`
  - Expected: 201, succeeds

- [ ] **Extra whitespace in name trimmed**
  - Input: `{ name: "  John Doe  " }`
  - Expected: Name stored as "John Doe" (trimmed)

---

### 2. Login Endpoint (`POST /api/auth/login`)

#### Happy Path
- [ ] **Valid login returns token**
  - Setup: Create user with email "john@test.com", password "Test@123"
  - Input: `{ email: "john@test.com", password: "Test@123" }`
  - Expected: 200, token returned, lastLogin updated

- [ ] **Login resets failed attempts**
  - Setup: Create user, fail login 3 times, then succeed
  - Expected: failedLoginAttempts = 0 after successful login

#### Invalid Credentials (User Enumeration Protection)
- [ ] **Generic error for non-existent email**
  - Input: `{ email: "nonexistent@test.com", password: "Test@123" }`
  - Expected: 401, "Invalid email or password" (not "user not found")

- [ ] **Generic error for invalid password**
  - Setup: Create user with password "Test@123"
  - Input: `{ email: "john@test.com", password: "Wrong@123" }`
  - Expected: 401, "Invalid email or password" (same as non-existent)

#### Account Lockout (Brute Force Protection)
- [ ] **Account locks after 5 failed attempts**
  - Setup: Create user
  - Action: Try login 5 times with wrong password
  - Expected: 
    - Attempts 1-4: 401 with generic error
    - Attempt 5: 429, "Account is temporarily locked"
    - failedLoginAttempts = 5

- [ ] **Account unlocks after 15 minutes**
  - Setup: Lock account, mock time +15 min
  - Input: Try login with correct password
  - Expected: 200, login succeeds
  - Verify: lockedUntil = null

- [ ] **Failed attempt during lockout doesn't increment counter**
  - Setup: Lock account, wait, attempt with wrong password
  - Expected: Still locked status

#### Deactivated Account
- [ ] **Deactivated account rejected**
  - Setup: Create user, set isActive = false
  - Input: Valid credentials
  - Expected: 403, "Account has been deactivated"

#### Input Validation
- [ ] **Missing email rejected**
  - Input: `{ password: "Test@123" }`
  - Expected: 400, "Email is required"

- [ ] **Missing password rejected**
  - Input: `{ email: "john@test.com" }`
  - Expected: 400, "Password is required"

- [ ] **Email normalized to lowercase**
  - Setup: User registered with "John@test.com"
  - Input: `{ email: "JOHN@TEST.COM", password: ... }`
  - Expected: 200, login succeeds

---

### 3. Get Current User (`GET /api/auth/me`)

#### Happy Path
- [ ] **Returns authenticated user**
  - Setup: Create user, get valid token
  - Input: `Authorization: Bearer <valid-token>`
  - Expected: 200, user object with id, name, email, isActive, lastLogin

#### Missing/Invalid Token
- [ ] **Rejects missing Authorization header**
  - Input: Request without Authorization header
  - Expected: 401, "No authorization token provided"

- [ ] **Rejects invalid Bearer format**
  - Input: `Authorization: "token123"` (no Bearer prefix)
  - Expected: 401, "Invalid authorization header format"

- [ ] **Rejects expired token**
  - Setup: Create user, generate token, set to expire
  - Input: Expired token
  - Expected: 401, "Token has expired"

- [ ] **Rejects tampered token**
  - Input: Token with modified payload
  - Expected: 401, "Invalid token"

- [ ] **Rejects empty Bearer token**
  - Input: `Authorization: "Bearer "` (nothing after Bearer)
  - Expected: 401, "No token provided"

#### Edge Cases
- [ ] **User not found (deleted after auth)**
  - Setup: Create user, get token, delete user, call /me
  - Expected: 404, "User not found"

---

### 4. Logout Endpoint (`POST /api/auth/logout`)

#### Happy Path
- [ ] **Logout succeeds with valid token**
  - Input: `Authorization: Bearer <valid-token>`
  - Expected: 200, success message

#### Missing/Invalid Auth
- [ ] **Rejects missing token**
  - Expected: 401, "No authorization token provided"

- [ ] **Rejects invalid token**
  - Expected: 401, "Authentication failed"

---

### 5. JWT Utilities (`src/utils/jwtHelper.ts`)

#### Token Generation
- [ ] **Generated token contains userId**
  - Action: Call `generateToken(42)`
  - Verify: Decoded payload has `userId: 42`

- [ ] **Token expires after 24 hours**
  - Action: Generate token, verify exp claim
  - Expected: exp = now + 24 hours

- [ ] **Token invalid before issuance (nbf claim)**
  - Action: Create token with future `iat`
  - Expected: Verification fails

#### Token Verification
- [ ] **Verifies valid token**
  - Action: Generate and immediately verify
  - Expected: Returns `{ userId: X }`

- [ ] **Rejects expired token**
  - Action: Generate token with 0 expiry, wait, verify
  - Expected: Throws `TokenExpiredError`

- [ ] **Rejects malformed token**
  - Action: Pass random string
  - Expected: Throws error with "Invalid token"

- [ ] **Rejects tampered payload**
  - Action: Modify token payload, verify
  - Expected: Throws "Invalid token"

- [ ] **Rejects token signed with wrong key**
  - Action: Sign with different secret, verify with original secret
  - Expected: Throws error

#### Token Decoding
- [ ] **Decodes valid token without verification**
  - Action: Call `decodeToken(token)`
  - Expected: Returns payload

- [ ] **Safely handles invalid token in decoding**
  - Action: Call `decodeToken("garbage")`
  - Expected: Returns null (doesn't throw)

---

### 6. Password Helper (`src/utils/passwordHelper.ts`)

#### Hashing & Comparison
- [ ] **Hashes password with bcrypt**
  - Action: Call `hashPassword("Test@123")`
  - Expected: Returns bcrypt hash (starts with $2b$)

- [ ] **Different hashes for same password**
  - Action: Hash same password twice
  - Expected: Two different hashes (due to salt)

- [ ] **Matches correct password**
  - Setup: Hash "Test@123"
  - Action: Compare "Test@123" with hash
  - Expected: True

- [ ] **Rejects wrong password**
  - Setup: Hash "Test@123"
  - Action: Compare "Test@456" with hash
  - Expected: False

- [ ] **Constant-time comparison (no timing leaks)**
  - Action: Compare short vs long wrong passwords
  - Verify: Similar execution time (use benchmark)

#### Password Strength Validation
- [ ] **Accepts strong password**
  - Input: "Test@123"
  - Expected: `{ isValid: true, errors: [] }`

- [ ] **Rejects all-lowercase**
  - Input: "test@12345"
  - Expected: includes "uppercase letter" error

- [ ] **Rejects all-uppercase**
  - Input: "TEST@12345"
  - Expected: includes "lowercase letter" error

- [ ] **Rejects no special char**
  - Input: "Test12345"
  - Expected: includes "special character" error

- [ ] **Rejects too short**
  - Input: "Test@1"
  - Expected: includes "8 characters" error

- [ ] **Reports multiple errors**
  - Input: "test" (all errors)
  - Expected: errors array has 5+ items

#### Common Password Check
- [ ] **Rejects common passwords**
  - Input: "password123", "admin", "123456", "qwerty"
  - Expected: All return True (is common)

- [ ] **Case-insensitive common check**
  - Input: "PASSWORD123", "Admin"
  - Expected: Returns True

- [ ] **Accepts uncommon password**
  - Input: "Xyz@9876"
  - Expected: False (not common)

---

## FRONTEND AUTH TESTS NEEDED

### 1. LoginScreen Component Tests

#### Render State
- [ ] **Renders login form by default**
  - Expected: Email input, password input, login button visible

- [ ] **Renders signup form when toggling mode**
  - Action: Click "Create account" toggle
  - Expected: Name input appears, signup button visible

- [ ] **Toggles back to login form**
  - Action: Click toggle again
  - Expected: Name input hidden, login button shown

#### Login Form Submission
- [ ] **Calls auth.login with email and password**
  - Setup: Mock auth context
  - Action: Enter email, password, submit
  - Expected: `auth.login("user@test.com", "password")` called

- [ ] **Shows loading state during login**
  - Setup: Mock slow login
  - Action: Submit form
  - Expected: ActivityIndicator visible, button disabled

- [ ] **Displays error message on login failure**
  - Setup: Mock login to throw error "Invalid credentials"
  - Action: Submit form
  - Expected: Error message displayed in red

- [ ] **Clears previous errors on new submission**
  - Setup: Previous login failed, error shown
  - Action: Enter new credentials, submit
  - Expected: Old error cleared during loading

- [ ] **Navigates to Home on successful login**
  - Setup: Mock successful login
  - Action: Submit form
  - Expected: Navigation triggered to Home screen

#### Signup Form Submission
- [ ] **Calls auth.signup with email, password, name**
  - Setup: Toggle to signup mode, mock auth context
  - Action: Fill form, submit
  - Expected: `auth.signup(email, password, name)` called

- [ ] **Shows validation errors from signup**
  - Setup: Mock signup to throw validation error
  - Action: Submit
  - Expected: Error message displayed

- [ ] **Navigates to Home on successful signup**
  - Expected: Navigation triggers after signup

#### Input Validation (UI)
- [ ] **Enables login button when both fields filled**
  - Action: Enter email and password
  - Expected: Button enabled

- [ ] **Disables button with empty email**
  - Expected: Button disabled

- [ ] **Shows email input focus border**
  - Action: Tap email input
  - Expected: Focus indicator visible

#### Error States
- [ ] **"Invalid credentials" shown on 401**
  - Expected: User-friendly message

- [ ] **"Email already in use" on 409**
  - Expected: Specific message

- [ ] **Generic error on 500**
  - Expected: "Something went wrong" message

- [ ] **Network error handling**
  - Setup: Mock network failure
  - Expected: "Network error" message

- [ ] **Dismiss error when tapping input again**
  - Expected: Error cleared on user interaction

---

### 2. AuthContext Provider Tests

#### Hydration from Storage
- [ ] **Initializes with loading state**
  - Expected: `isHydrating: true`, `isAuthenticated: false`

- [ ] **Restores token from AsyncStorage**
  - Setup: Store token in AsyncStorage, mount provider
  - Expected: `token` set, `isHydrating: false`

- [ ] **Restores user from AsyncStorage**
  - Setup: Store user JSON in AsyncStorage
  - Expected: `user` object restored

- [ ] **Sets auth header on token restore**
  - Setup: Token in storage
  - Expected: HTTP interceptor called with token

- [ ] **Handles missing token gracefully**
  - Setup: No token in storage
  - Expected: `token: null`, `user: null`, no error

- [ ] **Clears state if both token and user missing**
  - Expected: `isAuthenticated: false`

#### Signup Flow
- [ ] **Calls http.post to /auth/signup**
  - Action: Call `signup("user@test.com", "Pass@123", "John")`
  - Expected: POST to `/auth/signup` with payload

- [ ] **Stores token in AsyncStorage**
  - Expected: `AsyncStorage.setItem(STORAGE_KEY_TOKEN, token)` called

- [ ] **Stores user in AsyncStorage**
  - Expected: `AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user))` called

- [ ] **Updates state with token and user**
  - Expected: `token` and `user` state updated

- [ ] **Sets auth header after signup**
  - Expected: HTTP interceptor updated with token

- [ ] **Handles signup validation error**
  - Setup: Mock 400 with validation details
  - Expected: `error` string updated with validation message

- [ ] **Sets loading state during signup**
  - Action: Start signup
  - Expected: `isLoading: true`, then false after response

- [ ] **Throws error for network failure**
  - Setup: Mock network error
  - Expected: Error re-thrown, error state updated

#### Login Flow
- [ ] **Calls http.post to /auth/login**
  - Expected: POST with email and password

- [ ] **Stores token and user on success**
  - Expected: Both in AsyncStorage and state

- [ ] **Updates lastLogin on successful login**
  - Setup: Store user, login
  - Expected: User object has updated lastLogin

- [ ] **Handles generic auth error (401)**
  - Setup: Mock 401 response
  - Expected: "Invalid credentials" error message

- [ ] **Handles account locked error (429)**
  - Setup: Mock 429 ACCOUNT_LOCKED
  - Expected: "Account locked" error message

- [ ] **Handles account inactive error (403)**
  - Setup: Mock 403 ACCOUNT_INACTIVE
  - Expected: "Account deactivated" error message

- [ ] **Sets loading during login**
  - Expected: `isLoading: true` until response

#### Logout Flow
- [ ] **Calls http.post to /auth/logout**
  - Action: Call `logout()`
  - Expected: POST request sent

- [ ] **Clears token from AsyncStorage**
  - Expected: `AsyncStorage.removeItem(STORAGE_KEY_TOKEN)` called

- [ ] **Clears user from AsyncStorage**
  - Expected: `AsyncStorage.removeItem(STORAGE_KEY_USER)` called

- [ ] **Clears auth header**
  - Expected: HTTP interceptor cleared

- [ ] **Clears state**
  - Expected: `token: null`, `user: null`, `isAuthenticated: false`

- [ ] **Handles logout error gracefully**
  - Setup: Mock logout to throw error
  - Expected: Still clears local state (best effort)

#### Context Hook
- [ ] **useAuth hook returns context**
  - Expected: Returns `{ user, token, login, signup, logout, ... }`

- [ ] **useAuth throws if outside provider**
  - Expected: Error or warning

- [ ] **isAuthenticated computed correctly**
  - Expected: `true` only when both token and user exist

#### Error Clearing
- [ ] **clearError() resets error state**
  - Setup: Set error
  - Expected: `error: null` after clear

---

### 3. HTTP Client & Interceptors Tests

#### Request Interceptor
- [ ] **Adds Authorization header when token set**
  - Setup: Call `setAuthToken("token123")`
  - Action: Make request
  - Expected: `Authorization: Bearer token123` in headers

- [ ] **Doesn't add header when no token**
  - Setup: No token set
  - Expected: No Authorization header

- [ ] **Includes Content-Type header**
  - Expected: `Content-Type: application/json`

#### Response Interceptor
- [ ] **Normalizes success response**
  - Input: Raw response with nested data
  - Expected: Extracts and returns `response.data`

- [ ] **Normalizes error response**
  - Input: 400 error with error details
  - Expected: Throws normalized error with message, code, status

- [ ] **Handles network timeout**
  - Setup: Mock timeout
  - Expected: Error thrown with timeout message

- [ ] **Handles CORS error**
  - Expected: Appropriate error message

---

## SECURITY TESTS NEEDED

### 1. Authentication Security

#### SQL Injection Prevention
- [ ] **Email input with SQL escapes safely**
  - Input: `admin' OR '1'='1`
  - Expected: Treated as literal string, no injection

- [ ] **Name input with SQL escapes safely**
  - Input: `'; DROP TABLE users; --`
  - Expected: Stored as literal, no execution

#### Password Security
- [ ] **Password never logged in plaintext**
  - Setup: Monitor logs during signup/login
  - Expected: No plaintext passwords in logs

- [ ] **Hashed password irreversible**
  - Action: Get hashed password from DB
  - Expected: Cannot recover original password

- [ ] **Constant-time comparison prevents timing attacks**
  - Action: Measure time for correct vs wrong password
  - Expected: Similar execution time (no data leakage)

#### User Enumeration Prevention
- [ ] **Signup error doesn't reveal if email exists**
  - Setup: Try duplicate email
  - Expected: Generic "Unable to create account" message

- [ ] **Login error doesn't reveal if user exists**
  - Setup: Try non-existent email
  - Expected: Same error as wrong password

- [ ] **Auth failure doesn't reveal user details**
  - Expected: No email/name in error response

#### Brute Force Protection
- [ ] **Account locks after 5 failed login attempts**
  - Expected: 429 on 5th attempt

- [ ] **Lockout persists for 15 minutes**
  - Expected: Cannot login for 15 minutes

- [ ] **Each failed attempt increments counter**
  - Expected: failedLoginAttempts incremented

- [ ] **Successful login resets counter**
  - Expected: failedLoginAttempts = 0

#### Session/Token Security
- [ ] **Token expires after 24 hours**
  - Expected: Cannot use expired token for auth

- [ ] **Token cannot be forged**
  - Action: Create fake token with modified payload
  - Expected: Signature validation fails

- [ ] **Token secret not exposed in responses**
  - Expected: Secret not included in any API response

- [ ] **Bearer token required for protected endpoints**
  - Expected: 401 without token

- [ ] **Logout invalidates token on client**
  - Expected: Token removed from storage, headers cleared
  - Note: Server-side blacklist in Phase 2

### 2. Input Validation Security

#### Type Checking
- [ ] **Email field must be string**
  - Input: `{ email: 123 }`
  - Expected: 400, validation error

- [ ] **Password field must be string**
  - Input: `{ password: true }`
  - Expected: 400, validation error

#### Length Limits
- [ ] **Email max length enforced**
  - Input: 300+ character email
  - Expected: 400 or truncated safely

- [ ] **Password max length enforced**
  - Input: Very long password
  - Expected: Accepted (or max enforced)

- [ ] **Name max length enforced**
  - Input: 200 character name
  - Expected: 400, "less than 100 characters"

#### Format Validation  
- [ ] **Email must be valid RFC5321 format**
  - Invalid: `user@.com`, `@example.com`, `user@example`
  - Expected: All rejected with 400

- [ ] **Name must be alphabetic + symbols only**
  - Invalid: `John123`, `José🎉` (emoji)
  - Expected: Rejected

### 3. Authorization Security

#### Protected Endpoints
- [ ] **Expense CREATE requires auth**
  - Input: No token
  - Expected: 401

- [ ] **Expense READ requires auth**
  - Expected: 401 without token

- [ ] **Group operations require auth**
  - Expected: 401 without token

- [ ] **User isolation enforced**
  - Setup: User A token, try to access User B's expenses
  - Expected: 403 or 404 (not authorized)

### 4. HTTP Security

#### Headers Validation
- [ ] **CORS properly configured**
  - Expected: Frontend origin allowed, others blocked

- [ ] **Content-Type validation**
  - Input: Form data instead of JSON
  - Expected: 400 or proper handling

- [ ] **Content-Length limits enforced**
  - Input: Extremely large payload
  - Expected: 413 Payload Too Large

---

## TESTING INFRASTRUCTURE

### Backend Test Setup
```bash
# Install dependencies
npm install --save-dev @testing-library/react @testing-library/jest-dom

# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Frontend Test Setup
```bash
# Install Vitest dependencies
npm install --save-dev vitest @testing-library/react-native

# Run frontend tests
npm run test

# Watch mode
npm run test:watch
```

### Mock Data & Fixtures
- Common valid passwords (strong & common)
- Test user accounts with various states
- JWT sample tokens
- HTTP error responses

### Test Utilities
- Auth context mocking for component tests
- Prisma mocking for controller tests
- HTTP client mocking for integration tests
- Time mocking for lockout/expiry tests

---

## EXECUTION TIMELINE

| Phase | Task | Estimated | Status |
|-------|------|-----------|--------|
| 1 | Backend auth tests (signup/login) | 4 hours | ⏳ Pending |
| 2 | Backend JWT + password helper tests | 2 hours | ⏳ Pending |
| 3 | Frontend LoginScreen tests | 2 hours | ⏳ Pending |
| 4 | Frontend AuthContext tests | 3 hours | ⏳ Pending |
| 5 | Security vulnerability tests | 3 hours | ⏳ Pending |
| 6 | Code review & fixes | 2 hours | ⏳ Pending |
| **Total** | | **16 hours** | |

---

## SUCCESS CRITERIA

✅ All test cases pass  
✅ Code coverage >80% for auth modules  
✅ No security vulnerabilities found  
✅ All edge cases handled gracefully  
✅ Error messages appropriate and secure  
✅ No plaintext password leaks in logs  

---

## NOTES

1. **Security First:** Tests emphasize security (no user enumeration, constant-time comparison, etc.)
2. **Real Database:** Initially use test database; consider in-memory SQLite for speed
3. **Mocking Depth:** Mock Prisma for unit tests, real DB for integration tests
4. **Error Messages:** Verify generic messages don't leak sensitive information
5. **Performance:** Monitor test execution time (target <30s for full suite)

