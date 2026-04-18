# 🔧 CHECKPOINT: April 18, 2026 - Array Indexing Fixes (v0.3.4)

**Timestamp:** April 18, 2026 - Current Session  
**Focus:** Fixed 2 critical bugs blocking split type persistence  
**Session Type:** Bug fix sprint (array indexing architecture)

---

## 🎯 Problems Resolved

### ❌ → ✅ Bug #1: NaN Display on Reopened Expenses

**Symptom:**
```
User action: Save expense with PERCENTAGE split (50%, 50% on 2 members)
Expected: Reopen → Shows 50, 50
Actual: Reopen → Shows NaN, NaN
```

**Root Cause:**
- Backend changed to store splits with ONLY member values: `[member0, member1, ...]` (no payer)
- Frontend was still trying to load with old format: expecting payer at [0], members at [1+]
- Accessing wrong indices (1+) didn't exist → undefined → NaN

**Technical Fix:**
```typescript
// BEFORE (WRONG):
expense.splitWith.forEach((user, idx) => {
  if (expense.splitPercentage?.[idx + 1]) {  // ← Wrong! Offset by 1
    updatePercentage(user.id, expense.splitPercentage[idx + 1].toString());
  }
});

// AFTER (CORRECT):
expense.splitWith.forEach((user, idx) => {
  if (expense.splitPercentage?.[idx]) {  // ← Correct! Direct indexing
    updatePercentage(user.id, expense.splitPercentage[idx].toString());
  }
});
```

**Files Changed:**
- `frontend/src/screens/EditExpenseScreen.tsx` lines 69-91

**Impact:**
- Fixes both PERCENTAGE and AMOUNT split type persistence
- Aligns frontend loading with backend storage format
- Zero TypeScript errors

---

### ❌ → ✅ Bug #2: Split Members Override on Load

**Symptom:**
```
User action: Paid by Person 3, Split: Person 1 & 2 at 50% each
Expected: Reopen → 50%, 50% on 2 members
Actual: Reopen → 33%, 33%, 33% on all 3 members
```

**Root Cause:**
- `prefillFromExpense()` sets paidById → triggers re-render
- Reinitialize effect fires with new paidById value
- Effect resets splitWithIds to ALL members (except paidById)
- Then addMember() calls run but override already happened
- Auto-recalc: 100/3 = 33% instead of 100/2 = 50%

**Technical Fix:**
```typescript
// useSplitCalculator.ts - Added savedExpense parameter
export function useSplitCalculator(
  expenseAmount: string,
  paidById: number | null,
  groupMembers: Array<{ id: number; name: string }> = [],
  savedExpense?: any  // ← NEW PARAMETER
): UseSplitCalculatorReturn {

// In reinitialize effect:
useEffect(() => {
  setSplitState(prev => {
    // NEW: Check if loading saved expense
    if (savedExpense?.splitWith && savedExpense.splitWith.length > 0) {
      return prev;  // ← SKIP reinitialization!
    }
    
    // Rest of logic for new expenses...
  });
}, [paidById, groupMembers.length, savedExpense?.splitWith?.length]);
```

**Call Site Update:**
```typescript
// EditExpenseScreen.tsx
const { splitState, ... } = useSplitCalculator(
  formState.amount, 
  formState.paidById, 
  groupMembers,
  expense  // ← Pass expense object
);
```

**Files Changed:**
- `frontend/src/screens/EditExpenseScreen.tsx` line 61
- `frontend/src/screens/EditExpenseScreen/hooks/useSplitCalculator.ts` lines 46-51, 86-126

**Impact:**
- Preserves user's actual split selection (not overridden by reinitialize)
- Allows addMember() calls to populate correct members
- Auto-recalc now uses correct member count

---

## 🧪 Testing Status

**Status:** ⏳ AWAITING USER VERIFICATION

**How to Test:**
1. Press **R, R** in Expo to reload frontend
2. Create new expense with 3 members, set payer = person 3, split = persons 1 & 2 (50% each)
3. Click "Save"
4. Click back to list
5. Click expense to reopen
6. **Expected:** Shows 50%, 50% on 2 members (Person 1, Person 2), Paid by Person 3
7. **Previous bug:** Would show 33%, 33%, 33% on all 3

**Also Test:**
- Same flow with AMOUNT split (e.g., £50 split = £25, £25)
- Verify NaN values are gone
- Verify balance calculations correct

---

## 🏗️ Architecture Documentation

### Array Storage Format (Backend → Frontend)

**Backend Storage (expenseService.ts):**
```typescript
// Payer is SEPARATE - not in split arrays
expense.paidById = 3              // Person 3 paid
expense.splitWithIds = [1, 2]     // Split ONLY with persons 1 & 2
expense.splitAmount = [25, 25]    // [person1_amt, person2_amt]
expense.splitPercentage = [50, 50] // [person1_%, person2_%]
// Note: Payer (person 3) values NOT in arrays
```

**Frontend Storage (during edit):**
```typescript
// Same structure mirrored in React state
splitWithIds: [1, 2]
splitAmount: { 1: '25', 2: '25' }    // Map: memberId → amount
splitPercentage: { 1: '50', 2: '50' } // Map: memberId → percentage
paidById: 3 // Separate from split arrays
```

**Frontend Loading (EditExpenseScreen.tsx):**
```typescript
// Maps arrays back to state using direct indexing
expense.splitWith.forEach((user, idx) => {
  // user = expense.splitWith[idx] = member object
  // expense.splitAmount[idx] = member's amount
  updateAmount(user.id, expense.splitAmount[idx].toString());
});
// Result: { 1: '25', 2: '25' } map in state
```

### Initialization Sequence (NOW PROTECTED)

1. **Load Expense Data:**
   - useExpenseData fetches expense, categories, members (parallel)
   
2. **Prefill Form (Triggers Rerender):**
   - prefillFromExpense() sets title, amount, category, **paidById**, date, notes
   - State change triggers all dependent effects

3. **Reinitialize Split (PROTECTED - NEW):**
   - useSplitCalculator reinitialize effect fires
   - **NEW CHECK:** if (savedExpense?.splitWith) return prev; ← SKIP
   - Only reinitialize if new expense (no savedExpense)

4. **Populate Split Members:**
   - EditExpenseScreen useEffect calls addMember() for each saved member
   - Now populates into correct, non-overridden state

5. **Set Split Type & Load Values:**
   - setSplitType() updates split type
   - Load amounts/percentages using corrected direct indexing

**Key Protection:** savedExpense parameter + check prevents premature reinitialization

---

## 📝 Code Quality

**TypeScript Status:** ✅ Zero errors
- Verified with `get_errors` on both modified files

**Dependencies:**
- EditExpenseScreen.tsx: passes `expense` to useSplitCalculator
- useSplitCalculator: declares `savedExpense?` parameter
- Dependency arrays: correctly include `savedExpense?.splitWith?.length`

**Backward Compatibility:**
- `savedExpense` parameter is optional (? - undefined on new expenses)
- Old code paths still work (new expenses initialize normally)

---

## 🚀 Next Steps

1. **User Testing (BLOCKING):**
   - Test R,R reload → reopen saved expense → verify values display
   - Test with PERCENTAGE and AMOUNT split types
   
2. **Once Verified:**
   - Commit: `git add -A && git commit -m "v0.3.4: Fix array indexing for split type persistence"`
   - Push: `git push origin master`

3. **Future Improvements:**
   - Consider adding console.log() for debugging if issues persist
   - Add unit tests for prefillFromExpense logic
   - Document array storage format in CODING_PATTERNS.md

---

## 📚 Files Modified

| File | Lines | Changes |
|------|-------|---------|
| EditExpenseScreen.tsx | 61 | Pass `expense` param to useSplitCalculator |
| EditExpenseScreen.tsx | 69-91 | Fix array indexing: remove +1 offset |
| useSplitCalculator.ts | 46-51 | Add `savedExpense?` parameter |
| useSplitCalculator.ts | 86-126 | Add savedExpense check + dependency |

**Total Changes:** 4 modifications across 2 files

---

## ⚠️ Known Limitations

- None identified at this time. Array indexing architecture is now consistent.

---

## 🔗 References

- **MASTER_STATE.md:** Updated with v0.3.4 details
- **CODING_PATTERNS.md:** Should document array storage format
- **Backend Service:** expenseService.ts - validation tolerance 0.05
