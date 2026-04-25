# 🧪 TESTING CHECKPOINT - v0.3.1 EditExpenseScreen (Bug Fixes)

**Date:** April 15, 2026  
**Status:** 🟡 CONTEXT-ONLY (April 25, 2026) - Historical reference, stale for current work  
**Use When:** Working on EditExpenseScreen bugs or understanding past fixes  
**Navigation:** See [01-MASTER_STATE.md](./01-MASTER_STATE.md#-documentation-navigation) to decide if you need this  
**Feature:** EditExpenseScreen with split calculations & personal share - BUG FIX SESSION
**Status:** BUGS IDENTIFIED & FIXED ✅

---

## BUGS FOUND & FIXED THIS SESSION

### BUG 1: PERCENTAGE Split Validation Failing ❌→✅
**Issue:** After entering Payer 10% + Member 90% = 100%, got error "split percentages must sum to 100"
**Root Cause:** Frontend payload only sent members' percentages, skipped payer's %
**Fixed:** Now includes `[payerPercentage, member1Percentage, member2Percentage, ...]`
**Status:** ✅ FIXED

### BUG 2: PERCENTAGE Split Showing Duplicate Payer ❌→✅
**Issue:** Payer ("srabamiupadhyaya (Payer) - %") appeared twice in input fields
**Root Cause:** Payer could appear in both paidById AND splitWithIds, creating duplicate key
**Fixed:** Added filter to prevent payer appearing twice in rendered list
**Status:** ✅ FIXED

### BUG 3: Personal Share Not Updating for PERCENTAGE ❌→✅
**Issue:** "Your Personal Share" section showing wrong value (90% instead of 10%)
**Root Cause:** Calculation was `100 - (sum of others')` = backward logic
**Fixed:** Now calculates directly as `amount × (your% / 100)`
**Status:** ✅ FIXED - Updates LIVE as you change percentages

### BUG 4: Payer's % Not Loading on Reopen ❌→✅
**Issue:** Save expense with Payer 10%, reopen → showed Payer 0% instead
**Root Cause:** Load logic only read members' percentages (indices 1+), skipped payer at index 0
**Fixed:** Now reads `[0]=payer's %, [1+]=members' %` correctly
**Status:** ✅ FIXED

### BUG 5: ExpenseList "My Personal" Always 0.00 ❌→✅
**Issue:** Total column showed GBP 0.00 instead of GBP 936.35 (sum of all shares)
**Root Cause:** Only looked for user in `splitWith` members, ignored if user was payer
**Fixed:** Now checks both: is user payer? OR is user in splitWith? Calculates based on split type
**Status:** ✅ FIXED

### BUG 6: Summary Card Looking Like Expense Item ❌→✅
**Issue:** Total/Personal summary looked same as individual expense cards (confusing)
**Root Cause:** Styling too similar to expense list items
**Fixed:** Enhanced with light blue background, larger text, shadow, clearer visual hierarchy
**Status:** ✅ FIXED

---

## BEFORE TESTING (v0.3.1)

On your phone:
1. Shake device or press 'm'
2. Select **"Hard Reload"** / **"Clear Cache"**
3. Wait 30 seconds for rebuild from localhost:8081
4. **This is CRITICAL** - without it, old code persists in Expo

---

## 8 MOBILE TESTS (Updated with bug fixes)

### ✅ TEST 1: Calendar Date Selection
**What to do:**
1. Open an existing expense
2. Tap date field
3. Select a different date
4. Click "Done"

**Expected result:**
- Form shows updated date
- Future dates (> today) are grayed out/disabled
- Can't click on future dates

**Pass/Fail:** _______

---

### ✅ TEST 2: EQUAL Split
**What to do:**
1. Tap expense edit
2. Add 1+ members to split
3. Select **"EQUAL"** split type
4. Look at "Your Personal Share" section

**Expected result:**
- Shows: `amount ÷ (# people including you)`
- If 3 people total, shows: amount ÷ 3
- Share updates when you add/remove members

**Pass/Fail:** _______

---

### ✅ TEST 3: AMOUNT Split
**What to do:**
1. Add members, select **"AMOUNT"**
2. Enter amounts for each member
3. Look at "Your Personal Share" section

**Expected result:**
- Shows: `total - what others pay`
- If total 100 and others pay 60, you pay 40
- Try entering amounts > total → validation error
- Error message: "Split amounts must equal X"

**Pass/Fail:** _______

---

### ✅ TEST 4: PERCENTAGE Split (FIXED - No Duplicates!)
**What to do:**
1. Add members, select **"PERCENTAGE"**
2. **NOW FIXED:** You see YOURSELF + members (no duplicates)
3. Set percentages: You 10%, Member 90%
4. Look at "Your Personal Share" section

**Expected result:**
- Shows 2 people: "John Doe (Payer) - %" + "Member - %"
- NO DUPLICATES
- Your share = `amount × 10% ÷ 100` (FIXED - not 90% anymore)
- Try percentages not summing to 100% → validation error
- **BONUS:** Close modal → ExpenseList shows correct "My Personal" total
- **BONUS:** Reopen expense → percentages load correctly (Payer not 0%)

**Pass/Fail:** _______

---

### ✅ TEST 5: Update & Close Immediately
**What to do:**
1. Change expense (title, amount, etc.)
2. Click **"Update Expense"** button

**Expected result:**
- Modal closes IMMEDIATELY (no Alert dialog)
- Redirected back to expense list
- List shows updated expense values

**Pass/Fail:** _______

---

### ✅ TEST 6: Add Member Without Registration
**What to do:**
1. In group, add new member by email (one not registered)
2. Use format: `someEmail@domain.com`

**Expected result:**
- No error message
- Member appears in group
- Can select this member in expense splits

**Pass/Fail:** _______

---

### ✅ TEST 7: Reopen PERCENTAGE Expense (NEW - BUG FIX)
**What to do:**
1. Create/edit expense with PERCENTAGE split: You 10%, Member 90%
2. Click Update
3. Open that same expense again

**Expected result:**
- Payer shows 10% (NOT 0%)
- Member shows 90%
- Your Personal Share shows correct amount

**Pass/Fail:** _______

---

### ✅ TEST 8: ExpenseList Shows Correct "My Personal" (NEW - BUG FIX)
**What to do:**
1. Go to group with multiple expenses
2. Look at top summary card: "Total | My Personal"
3. Total = GBP 936.36, My Personal should = sum of your shares

**Expected result:**
- My Personal shows GBP 936.35 (or correct total, not 0.00)
- Summary card has light blue background (different from expense items)
- Text is larger and darker blue

**Pass/Fail:** _______

---

## RESULTS SUMMARY

| Test | Pass/Fail |
|------|-----------|
| 1. Calendar dates | ___ |
| 2. EQUAL split | ___ |
| 3. AMOUNT split | ___ |
| 4. PERCENTAGE split (no duplicates) | ___ |
| 5. Update closes | ___ |
| 6. Add member | ___ |
| 7. Reopen PERCENTAGE (payer % loads) | ___ |
| 8. ExpenseList My Personal (correct total) | ___ |

**All 8 Pass?** → Ready to commit v0.3.1 ✅

**Any Fail?** → Report which + screenshot + error message

---

## KEY FEATURES TO VERIFY

### Your Personal Share Section
This is the blue box that should appear on the edit screen when you add members:
- **EQUAL:** Shows calculated equal share
- **AMOUNT:** Shows your balance (total - others)
- **PERCENTAGE:** Shows your money amount based on your %
- **Updates LIVE:** Changes as you adjust splits

### PERCENTAGE Splits Now Shows YOU
**Previously:** Only other members shown  
**Now:** You (labeled "Payer") + other members shown  
**Why:** Can set your own percentage instead of having it calculated

---

## AFTER ALL TESTS PASS

```bash
git add -A
git commit -m "feat: add expense edit with calendar & personal share calculation"
```

Then report: ✅ Testing complete, all pass, committed to main

---

## TROUBLESHOOTING

**Issue: Changes not showing on mobile**
- Solution: Hard reload again (shake device)
- Make sure you see localhost:8081 building in terminal

**Issue: "Cannot read properties" error in split**
- Solution: Make sure you're re-adding your percentage in PERCENTAGE mode
- Should now see your name in the input list

**Issue: Calendar not showing past dates as selectable**
- This is expected - only today and past dates are selectable

**Issue: Future dates showing as selectable**
- Code bug exists - report which date was selectable
- Should be prevented by isFutureDate() check

---

## CODE LOCATIONS (For Reference)

**EditExpenseScreen Component:**
- `/frontend/src/screens/EditExpenseScreen.tsx`
- Personal share section: lines 964-1000
- PERCENTAGE split member list: lines 934-950
- Calendar date validation: lines 360-368

**Backend Services:**
- `/backend/src/services/expenseService.ts` - getExpenseById, updateExpense
- `/backend/src/services/groupService.ts` - addMemberByEmail

---

**Session Status:** 🟡 TESTING IN PROGRESS - Awaiting mobile validation