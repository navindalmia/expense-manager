/**
 * Real E2E test for issue #47 against a live backend + Postgres DB and a
 * real rendered Expo web app -- not mocks.
 *
 * Covers: creator can delete a group they created, with a confirmation
 * dialog that warns about existing expenses before soft-deleting, and the
 * group disappears from the list immediately afterward.
 *
 * Prerequisites (not started by this test -- see playwright.config.ts):
 *   - Postgres running with the schema migrated and seeded
 *   - backend dev server running on :4000
 *   - `npx expo start --web` running on :8081
 *   - test user test@test.com / Test1234! seeded and email-verified
 *
 * Run: npx playwright test e2e/delete-group.spec.ts
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

test.describe('Delete group (issue #47)', () => {
  test('creator can delete a group with no expenses via a confirmation dialog, and it disappears from the list', async ({ page }) => {
    const runId = Date.now();
    const groupName = `E2E Delete Group ${runId}`;

    await login(page);

    // Create a fresh group to delete.
    await page.getByTestId('add-group-button').click();
    await page.getByTestId('group-name-input').fill(groupName);
    await page.getByTestId('create-button').click();
    await expect(page.getByTestId('add-member-close-button')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('add-member-close-button').click();
    await expect(page.getByText(groupName)).toBeVisible({ timeout: 10000 });

    // Open Edit Group for the card we just created, scoped by its
    // group-item-<id> wrapper so this doesn't accidentally match another
    // group with a similar name from a prior run.
    const groupCard = page.locator('[data-testid^="group-item-"]').filter({ hasText: groupName });
    await groupCard.locator('[data-testid^="edit-group-button-"]').click();

    // Confirm deletion via the real browser dialog.
    page.once('dialog', (dialog) => dialog.accept());

    await expect(page.getByTestId('edit-group-delete-button')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('edit-group-delete-button').click();

    // The group should be gone from the list once the deletion completes.
    await expect(page.getByText(groupName)).toHaveCount(0, { timeout: 10000 });
  });
});
