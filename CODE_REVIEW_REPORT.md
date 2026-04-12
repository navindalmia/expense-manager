# Code Review Report - April 12, 2026
**Status:** ✅ READY TO COMMIT (with 1 blocking fix + 3 improvements)

---

## Summary

**Total Files Changed:** 24 files  
**Backend:** 13 files | **Frontend:** 11 files  
**Severity Levels:** 1 BLOCKING | 2 CRITICAL | 3 WARNINGS | 5 INFO

---

## 🔴 BLOCKING ISSUES (Must Fix Before Commit)

### 1. HomeScreen.tsx - TypeScript Compilation Errors (2 instances)
**File:** `frontend/src/screens/HomeScreen.tsx`  
**Lines:** 310, 326  
**Severity:** BLOCKING - Prevents build  

**Issue:**
```typescript
// ❌ WRONG - Tries to render object as string
<Text>{item.currency}</Text>  // Line 310
<Text>{item.totalAmount.toFixed(2)} {item.currency}</Text>  // Line 326

// ✅ CORRECT - Must access .code property
<Text>{item.currency.code}</Text>
<Text>{item.totalAmount.toFixed(2)} {item.currency.code}</Text>
```

**Root Cause:** Backend now returns `currency: { id, code, label }` but HomeScreen tries to render the whole object.

**Fix Required:** Change 2 lines to access `.code` property.

---

## 🟠 CRITICAL ISSUES

### 1. Email Uniqueness Without Null Handling
**File:** `backend/prisma/schema.prisma`  
**Model:** User  
**Line:** `email String? @unique`

**Issue:**
```prisma
email String? @unique  // PostgreSQL treats multiple NULLs as duplicates!
```

**Problem:**
- PostgreSQL allows only ONE NULL in a unique column  
- If you try to create 2 users with `email: null`, it will FAIL  
- This breaks the optional email feature for users with no email

**Fix Required:**
```prisma
// Option 1: Partial unique index (PostgreSQL 15+)
@@unique([email], map: "User_email_unique_partial", ignore: "null")

// Option 2: Application-side validation
// Only create email-less users OR ensure at least one email per group
```

**Current Impact:** 
- ✅ If all users have emails: Works fine  
- ❌ If you try to add 2 members with no email to a group: WILL FAIL

---

### 2. Missing Currency Include in createGroup Response
**File:** `backend/src/services/groupService.ts`  
**Function:** `createGroup()`  
**Line:** ~44

**Issue:**
```typescript
// createGroup() doesn't include currency in response
const group = await prisma.group.create({
  // ... data
  include: {
    createdBy: { select: { ... } },
    members: { select: { ... } },
    // ❌ MISSING: currency relationship
  },
});
```

**Problem:**
- Frontend expects `group.currency` object in response  
- createGroup returns incomplete structure  
- Frontend may crash when trying to access `currency.code`

**Fix:** Add currency to include:
```typescript
include: {
  currency: { select: { id: true, code: true, label: true } },
  createdBy: { ... },
  members: { ... },
}
```

---

### 3. Missing Validation in UpdateGroup for Existence Check
**File:** `backend/src/services/groupService.ts`  
**Function:** `updateGroup()`

**Issue:**
```typescript
// No check if group exists before trying to update
const updated = await prisma.group.update({
  where: { id: groupId },
  // ... data
});
```

**Problem:**
- Prisma throws cryptic error if group doesn't exist  
- Should throw AppError with proper error message

**Fix:** Add validation:
```typescript
const group = await prisma.group.findUnique({ where: { id: groupId } });
if (!group) {
  throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
}
```

---

## 🟡 WARNINGS (Should Fix)

### 1. Logger Not Imported in Category/Currency Controllers
**Files:** 
- `backend/src/controllers/categoryController.ts`  
- `backend/src/controllers/currencyController.ts`

**Issue:**
```typescript
import { logger } from '../utils/logger';  // ✅ Imported
logger.info('Categories fetched...');      // ✅ Used
```

**But:** These are new files and logger is a new utility. Ensure consistency across ALL controllers.

**Check:** Other controllers are NOT using logger yet:
- `authController.ts` - ❌ No logger
- `expenseController.ts` - ❌ No logger
- `groupController.ts` - ❌ No logger

**Impact:** New controllers have logging, old ones don't. **Inconsistent.**

**Recommendation:** Either:
1. Add logger to ALL controllers, OR  
2. Remove from new controllers for now  
(Choose one approach for consistency)

---

### 2. No Null Check for Optional Email in Signup
**File:** `backend/src/controllers/authController.ts`  
**Function:** `signup()`

**Issue:**
```typescript
const { email, password, name } = validateSignup(req.body);
// Above assumes email is always provided

// But schema allows null (optional email)
```

**Problem:**
- signup validation assumes email is always String  
- But User.email is now optional (String?)
- Should validate that email is provided at signup

**Current Behavior:** 
- ✅ If email provided: works
- ✅ If email null: validateSignup likely throws

**Recommendation:** Ensure validateSignup requires email at signup time.

---

### 3. Race Condition Risk in addMemberToGroup
**File:** `backend/src/services/groupService.ts`  
**Function:** `addMemberToGroup()`

**Issue:**
```typescript
// Check if member exists
const isMember = group.members?.some((m) => m.id === user.id);

// ... later ...

// Add user to group
const updated = await prisma.group.update({
  data: { members: { connect: { id: user.id } } }
});
// ⚠️ Between check and add, another request could add the same member
```

**Risk:** Low in practice but could cause:
- Duplicate constraint error  
- Confusing error message to frontend

**Recommendation:** Rely on database constraints + handle Prisma error:
```typescript
catch (error: any) {
  if (error.code === 'P2025') {  // Record not found
    // Member already added
    throw new AppError('User is already a member', 400, 'ALREADY_MEMBER');
  }
  throw error;
}
```

---

## 🔵 INFO / BEST PRACTICES

### 1. Good: Proper Error Classes Used
✅ **Observation:** New code uses `AppError` for consistent error handling.  
```typescript
throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND', { groupId });
```
This is excellent! Maintains consistency with app error handling.

---

### 2. Good: DB-Driven Currency/Category Lookup
✅ **Observation:** Currency and category lookups now use database instead of hardcoded enums.  
```typescript
const currencyRecord = await prisma.currency.findUnique({
  where: { code: currencyCode }
});
```
This allows extensibility (users can add custom currencies/categories).

---

### 3. Good: Placeholder User Pattern
✅ **Observation:** New optional email feature uses smart placeholder pattern:
```typescript
// If email exists without password → activate on signup
// If email doesn't exist → create placeholder with name + email
// If no email → create user with just name
```
Clean, well-documented business logic!

---

### 4. Frontend Service Types Properly Updated
✅ **Observation:** Frontend Group interface updated to match backend:
```typescript
// OLD: currency: string
// NEW: currency: { id: number, code: string, label: string }
```
Type safety maintained across API boundary.

---

### 5. Good: EditGroupModal Fetches Data from DB
✅ **Observation:** No hardcoding of currencies anymore:
```typescript
const [currencies, setCurrencies] = useState<Currency[]>([]);

useEffect(() => {
  const data = await getCurrencies();
  setCurrencies(data);
}, []);
```
Proper data-driven UI component.

---

## 📋 Checklist - Before Commit

### Required Fixes
- [ ] **BLOCKING:** Fix HomeScreen.tsx lines 310 + 326 (add `.code` property)
- [ ] **CRITICAL:** Add currency to createGroup include statement
- [ ] **CRITICAL:** Add group existence check in updateGroup

### Should Fix
- [ ] Decide on logger usage: keep new controllers or remove for consistency
- [ ] Document that optional email requires uniqueness workaround for DB constraints
- [ ] Add handleDuplicate catch in addMemberToGroup (defensive)

### Nice to Have
- [ ] Ensure all controllers use logger (future consistency)
- [ ] Add more JSDoc comments on new utility functions
- [ ] Test race conditions in concurrent member adds

---

## Files Status

### ✅ No Issues
- `backend/prisma/schema.prisma` - Schema changes are correct
- `backend/prisma/seed.ts` - Seed logic good (password hashing)
- `backend/src/utils/logger.ts` - Logger implementation solid
- `backend/src/controllers/categoryController.ts` - Clean implementation
- `backend/src/controllers/currencyController.ts` - Clean implementation
- `backend/src/routes/categoryRoutes.ts` - Routes look good
- `backend/src/routes/currencyRoutes.ts` - Routes look good
- `backend/src/schemas/expenseSchema.ts` - Schema validation updated properly
- `backend/src/services/expenseService.ts` - Currency FK lookup correct
- `frontend/src/services/categoryService.ts` - Service layer clean
- `frontend/src/services/currencyService.ts` - Service layer clean
- `frontend/src/services/groupService.ts` - Type updated correctly
- `frontend/src/components/EditGroupModal.tsx` - Component refactored well
- `frontend/src/screens/CreateExpenseScreen.tsx` - Date/currency pickers added
- `frontend/src/screens/ExpenseListScreen.tsx` - Summary calculation added

### ⚠️ Issues Found
- `backend/src/services/groupService.ts` - 2 CRITICAL issues
- `backend/src/controllers/authController.ts` - 1 WARNING
- `backend/src/services/groupService.ts` - 1 CRITICAL race condition
- `frontend/src/screens/HomeScreen.tsx` - 1 BLOCKING TypeScript error

---

## Next Actions

1. **Immediately:** Fix HomeScreen TypeScript errors (2 lines)  
2. **Before commit:** Fix 3 critical backend issues  
3. **After commit:** Run full test suite + manual QA

