// Manual Mobile Testing Checklist for Split Calculation Fix
// Date: April 24, 2026
// Feature: Fixed split calculation bug in ExpenseListScreen
// Bugs Fixed: 
//   1. calculateUserShare() incorrectly assumed payer was always in split
//   2. Refactored to use shared calculateMemberShare() (DRY)

/**
 * BEFORE TESTING ON MOBILE:
 * 1. Shake device or press 'm'
 * 2. Select "Hard Reload" / "Clear Cache"
 * 3. Wait 30 seconds for rebuild from localhost:8081
 * ⚠️ CRITICAL: Without hard reload, old code persists!
 */

/**
 * TEST SCENARIO 1: EQUAL Split - Single Member Only
 * 
 * This tests the original bug where expense with 1 member showed wrong share
 * 
 * Setup:
 *   - Create new expense: amount 23.00, category Dining
 *   - Select SPLIT_EQUAL split type
 *   - Add to split: ONLY test.5 (NOT yourself)
 *   - Save expense
 * 
 * Expected Results:
 *   ✅ Expense List shows: "Your share: GBP 23.00"
 *      (NOT 11.50 as it showed with the bug)
 *   ✅ Personal Total should include 23.00
 *   ✅ When you open the expense to edit, "Your Personal Share" shows 23.00
 * 
 * Why this matters:
 *   - OLD CODE: Calculated 23 ÷ 2 (assumed you + test.5 = 2 people)
 *   - NEW CODE: Calculates 23 ÷ 1 (only test.5 is in splitWith array)
 *   - This was the regression that prompted the fix
 */

/**
 * TEST SCENARIO 2: EQUAL Split - Multiple Members, Payer Not Included
 * 
 * Tests correct behavior when payer pays for others but isn't splitting
 * 
 * Setup:
 *   - Create new expense: amount 90.00, category Dining
 *   - Select SPLIT_EQUAL split type
 *   - Add to split: test.5 AND user.1 (NOT yourself as payer)
 *   - Save expense
 * 
 * Expected Results:
 *   ✅ Expense List shows: "Your share: GBP 0.00"
 *      (You paid for them but didn't split, so you don't owe yourself)
 *   ✅ test.5 sees: "Your share: GBP 45.00" (90 ÷ 2)
 *   ✅ user.1 sees: "Your share: GBP 45.00" (90 ÷ 2)
 *   ✅ Personal Total shows 0.00 for payer
 */

/**
 * TEST SCENARIO 3: EQUAL Split - Payer IS Included
 * 
 * Tests when payer also participates in the split
 * 
 * Setup:
 *   - Create new expense: amount 90.00, category Dining
 *   - Select SPLIT_EQUAL split type
 *   - Add to split: yourself + test.5 + user.1 (3 people total)
 *   - Save expense
 * 
 * Expected Results:
 *   ✅ Expense List shows: "Your share: GBP 30.00" (90 ÷ 3)
 *   ✅ test.5 sees: "Your share: GBP 30.00" (90 ÷ 3)
 *   ✅ user.1 sees: "Your share: GBP 30.00" (90 ÷ 3)
 *   ✅ Each person's Personal Total reflects their 30.00 share
 */

/**
 * TEST SCENARIO 4: PERCENTAGE Split - Payer Not in Split
 * 
 * Tests percentage calculation when payer isn't a member
 * 
 * Setup:
 *   - Create new expense: amount 100.00, category Rent
 *   - Select SPLIT_PERCENTAGE split type
 *   - Add percentages:
 *     * test.5: 60%
 *     * user.1: 40%
 *     (You are payer, NOT in split)
 *   - Save expense
 * 
 * Expected Results:
 *   ✅ Expense List shows: "Your share: GBP 0.00"
 *   ✅ test.5 sees: "Your share: GBP 60.00"
 *   ✅ user.1 sees: "Your share: GBP 40.00"
 *   ✅ Personal Totals reflect these amounts
 */

/**
 * TEST SCENARIO 5: AMOUNT Split - Custom Amounts, Payer Difference
 * 
 * Tests AMOUNT split where payer covers the difference
 * 
 * Setup:
 *   - Create new expense: amount 100.00, category Entertainment
 *   - Select SPLIT_AMOUNT split type
 *   - Set amounts:
 *     * test.5: 30.00
 *     * user.1: 20.00
 *     (You are payer and should owe: 100 - 30 - 20 = 50.00)
 *   - Save expense
 * 
 * Expected Results:
 *   ✅ Expense List shows: "Your share: GBP 50.00"
 *   ✅ test.5 sees: "Your share: GBP 30.00"
 *   ✅ user.1 sees: "Your share: GBP 20.00"
 *   ✅ Sum = 100.00 ✓
 */

/**
 * TEST SCENARIO 6: Rent Split - Real World Example
 * 
 * Tests real scenario from settlement screen
 * 
 * Setup:
 *   - Create new expense: amount 450.50, category Rent
 *   - Select SPLIT_EQUAL split type
 *   - Add to split: yourself + test.5 + user.1 (3 people)
 *   - Save expense
 * 
 * Expected Results:
 *   ✅ Each person's share: 450.50 ÷ 3 = 150.17
 *   ✅ Expense List shows each person: "Your share: GBP 150.17"
 *   ✅ All three can see the correct split
 *   ✅ Settlement screen will show rent expense in calculations
 */

/**
 * TEST SCENARIO 7: Reload & Verify Persistence
 * 
 * Tests that split calculations persist across app reload
 * 
 * Setup:
 *   - From Test Scenario 1 (Dinner 23.00, only test.5 in split)
 *   - Leave the app completely
 *   - Reopen the app, go back to expense list
 * 
 * Expected Results:
 *   ✅ Expense List still shows: "Your share: GBP 23.00"
 *   ✅ No flickering or incorrect calculation while loading
 *   ✅ Open the expense → "Your Personal Share" still shows 23.00
 */

/**
 * TEST SCENARIO 8: Edit Expense - Split Changes
 * 
 * Tests that adding/removing members updates calculations correctly
 * 
 * Setup:
 *   - From Test Scenario 1 (Dinner 23.00, only test.5)
 *   - Tap "Edit"
 *   - ADD yourself to the split
 *   - Save expense
 * 
 * Expected Results:
 *   ✅ BEFORE: "Your share: GBP 23.00"
 *   ✅ AFTER: "Your share: GBP 11.50" (23 ÷ 2)
 *   ✅ test.5 now sees: "Your share: GBP 11.50" (also changed)
 *   ✅ Persists correctly after edit
 */

/**
 * PASS/FAIL MATRIX
 * 
 * Scenario 1 (Bug regression):     [ ] PASS  [ ] FAIL
 * Scenario 2 (Payer not in split): [ ] PASS  [ ] FAIL
 * Scenario 3 (Payer is included):  [ ] PASS  [ ] FAIL
 * Scenario 4 (Percentage):          [ ] PASS  [ ] FAIL
 * Scenario 5 (Amount custom):       [ ] PASS  [ ] FAIL
 * Scenario 6 (Rent real world):     [ ] PASS  [ ] FAIL
 * Scenario 7 (Persistence):         [ ] PASS  [ ] FAIL
 * Scenario 8 (Edit & change):       [ ] PASS  [ ] FAIL
 * 
 * All 8 must PASS before committing!
 */

/**
 * IF A TEST FAILS:
 * 
 * 1. Hard reload the app (shake + "Clear Cache")
 * 2. Check browser console: F12 → Console tab
 * 3. Look for errors in calculateUserShare() or calculateMemberShare()
 * 4. Check ExpenseListScreen logs: "💰 Calculate share for expense..."
 * 5. Verify database has correct splitWith array
 * 6. Post failure details with:
 *    - Which scenario failed
 *    - What you expected vs what you got
 *    - Console errors (if any)
 */
