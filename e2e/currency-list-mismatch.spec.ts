/**
 * Real E2E test for issues #50/#51 against a live backend + Postgres DB
 * and a real rendered Expo web app -- not mocks.
 *
 * #50: CreateGroupScreen's currency picker used to be a hardcoded array
 * that included CNY, which the backend never seeded -- selecting it and
 * submitting failed with "Selected currency is not available."
 * #51: that same hardcoded array didn't match EditGroupModal's
 * live-fetched currency list, so Create and Edit showed different
 * currency options for the same app.
 *
 * The fix makes CreateGroupScreen fetch the same GET /api/currencies list
 * EditGroupModal already used, so this test verifies -- against the real
 * backend, not a mock -- that CNY is absent and a currency the old
 * hardcoded array never had (SEK) is both offered and actually
 * submittable.
 *
 * Prerequisites (not started by this test -- see playwright.config.ts):
 *   - Postgres running with the schema migrated and seeded
 *   - backend dev server running on :4000
 *   - `npx expo start --web` running on :8081
 *   - test user test@test.com / Test1234! seeded and email-verified
 *
 * Run: npx playwright test e2e/currency-list-mismatch.spec.ts
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'test@test.com';
const TEST_PASSWORD = 'Test1234!';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('email-input').fill(TEST_EMAIL);
  await page.getByTestId('password-input').fill(TEST_PASSWORD);
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 15000 });
}

test.describe('Currency list consistency (issues #50, #51)', () => {
  test('Create Group does not offer CNY and does offer SEK, and a non-CNY currency actually submits', async ({ page }) => {
    const runId = Date.now();
    const groupName = `E2E Currency Group ${runId}`;

    await login(page);

    await page.getByTestId('add-group-button').click();
    await page.getByTestId('group-name-input').fill(groupName);

    // #50: CNY was never seeded on the backend -- it must not appear as an
    // option at all now that the picker is backend-driven.
    await expect(page.getByTestId('currency-CNY')).toHaveCount(0);

    // #51: SEK is a real backend currency the old hardcoded array never
    // listed -- it must now appear, proving Create matches Edit's list.
    await expect(page.getByTestId('currency-SEK')).toBeVisible({ timeout: 10000 });

    // Select SEK and confirm the group actually creates successfully
    // (no "Selected currency is not available" error), proving this isn't
    // just a cosmetic list fix -- the previously-unreachable currencies
    // are genuinely usable end-to-end.
    await page.getByTestId('currency-SEK').click();
    await page.getByTestId('create-button').click();

    await expect(page.getByTestId('add-member-close-button')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('add-member-close-button').click();

    await expect(page.getByText(groupName)).toBeVisible({ timeout: 10000 });
  });
});
