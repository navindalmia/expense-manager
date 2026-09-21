/**
 * Real E2E test for issue #46 ("Expense card not reflecting true share
 * calculation", repro hint "Check Dinner card") against a live backend +
 * Postgres DB and a real rendered Expo web app -- not mocks.
 *
 * Root cause (fixed in frontend/src/utils/calculateUserExpenseShare.ts,
 * shared by ExpenseListScreen.tsx and, formerly, a dead duplicate in
 * SettlementScreen.tsx; backend's own separate copy in groupService.ts
 * fixed independently): a payer who pays for an expense but excludes
 * themselves entirely from a PERCENTAGE split (e.g. treating a guest to
 * 100%) had their own "Your share" on the expense card wrongly computed
 * as the FULL expense amount instead of 0 -- the calculation fell back to
 * the first *other* split member's percentage-based amount instead of
 * recognizing the payer isn't in the split at all.
 *
 * This test needs a second real user (the guest) to add to the group, via
 * the real signup + add-member-by-email API, matching this repo's
 * existing e2e/ convention of exercising the real flow rather than
 * seeding directly.
 *
 * Prerequisites (not started by this test -- see playwright.config.ts):
 *   - Postgres running with the schema migrated and seeded
 *   - backend dev server running on :4000
 *   - `npx expo start --web` running on :8081
 *   - test user test@test.com / Test1234! seeded and email-verified
 *
 * Run: npx playwright test e2e/regression/issue-46-expense-card-share-percentage.spec.ts
 */

import { test, expect } from '@playwright/test';

const HOST_EMAIL = 'test@test.com';
const HOST_PASSWORD = 'Test1234!';
const API_BASE_URL = 'http://localhost:4000/api';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('email-input').fill(HOST_EMAIL);
  await page.getByTestId('password-input').fill(HOST_PASSWORD);
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 15000 });
}

test.describe('Expense card share calculation, payer excluded from PERCENTAGE split (issue #46)', () => {
  test('host paying 100% for a guest sees their own "Your share" as 0.00, not the full amount', async ({ page, request }) => {
    const runId = Date.now();
    const guestEmail = `e2e-guest-${runId}@test.com`;
    const groupName = `E2E Dinner Group ${runId}`;

    // Real signup for the guest via the API (matches this repo's existing
    // e2e/ convention -- e.g. delete-group.spec.ts's login() pattern --
    // of going through the real API/UI rather than seeding the DB
    // directly).
    await request.post(`${API_BASE_URL}/auth/signup`, {
      data: { email: guestEmail, password: 'Test1234!', name: 'E2E Guest' },
    });

    await login(page);

    // Create a fresh group and add the guest as a real member.
    await page.getByTestId('add-group-button').click();
    await page.getByTestId('group-name-input').fill(groupName);
    await page.getByTestId('create-button').click();
    await expect(page.getByTestId('add-member-email-input')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('add-member-email-input').fill(guestEmail);
    await page.getByTestId('add-member-add-button').click();
    // AddMemberModal shows a brief success state (~1.5s) then calls
    // onMemberAdded, which closes the modal itself -- no manual close
    // click needed (and racing one against the auto-close was flaky).
    await expect(page.getByTestId('add-member-close-button')).toHaveCount(0, { timeout: 10000 });

    await expect(page.getByText(groupName)).toBeVisible({ timeout: 10000 });
    await page.getByText(groupName).click();
    await expect(page.getByTestId('expense-list-screen')).toBeVisible({ timeout: 10000 });

    // Add a "Dinner" expense, paid by the host (default), 100.
    await page.getByTestId('add-expense-button').click();
    await expect(page.getByTestId('edit-expense-title-input')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('edit-expense-title-input').fill('Dinner');
    await page.getByTestId('edit-expense-amount-input').fill('100');

    // Switch to a PERCENTAGE split.
    await page.getByTestId('edit-expense-split-type-picker-button').click();
    await page.getByTestId('edit-expense-split-type-option-PERCENTAGE').click();

    // Exclude the host from the split entirely (both members are selected
    // by default) -- the guest stays selected, gets 100%. The host's row
    // is the one carrying the "Payer" badge, more robust than assuming
    // member ordering.
    const hostToggle = page.locator('[data-testid^="split-member-toggle-"]').filter({ hasText: 'Payer' });
    await hostToggle.first().click();

    const guestPercentageInput = page.locator('[data-testid^="split-member-percentage-input-"]');
    await guestPercentageInput.first().fill('100');

    await page.getByTestId('edit-expense-save-button').click();
    await expect(page.getByTestId('expense-list-screen')).toBeVisible({ timeout: 10000 });
    // Scoped by testID prefix, not plain text -- stale "Dinner"-titled
    // expenses/groups from earlier local runs can otherwise make a bare
    // getByText('Dinner') ambiguous.
    await expect(page.locator('[data-testid^="expense-title-"]', { hasText: 'Dinner' })).toBeVisible({ timeout: 10000 });

    // The bug: this used to show "GBP 100.00" (the guest's 100% share,
    // wrongly attributed to the host) instead of "GBP 0.00" (the host
    // paid the bill but personally owes nothing -- the guest owes it all).
    // Exact text match, not a suffix regex -- an earlier unanchored
    // /0\.00$/ regex here matched "GBP 100.00" too (it also ends in
    // "0.00"), silently passing against the buggy code. Confirmed with a
    // throwaway debug script reading the real textContent ("GBP 100.00")
    // before fixing this assertion.
    const shareText = page.locator('[data-testid^="expense-your-share-"]').first();
    await expect(shareText).toHaveText('GBP 0.00', { timeout: 10000 });
  });
});
