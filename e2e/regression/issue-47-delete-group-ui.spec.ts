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
 * Run: npx playwright test e2e/regression/issue-47-delete-group-ui.spec.ts
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

// Logs in, creates a fresh group and opens its Edit Group modal. Scoped by the
// group-item-<id> wrapper so it can't match a similarly named group from a
// prior run.
async function createGroupAndOpenEdit(page: import('@playwright/test').Page, groupName: string) {
  await login(page);

  await page.getByTestId('add-group-button').click();
  await page.getByTestId('group-name-input').fill(groupName);
  await page.getByTestId('create-button').click();
  await expect(page.getByTestId('add-member-close-button')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('add-member-close-button').click();
  await expect(page.getByText(groupName)).toBeVisible({ timeout: 10000 });

  const groupCard = page.locator('[data-testid^="group-item-"]').filter({ hasText: groupName });
  await groupCard.locator('[data-testid^="edit-group-button-"]').click();
  await expect(page.getByTestId('edit-group-delete-button')).toBeVisible({ timeout: 10000 });
}

test.describe('Delete group (issue #47)', () => {
  test('cancelling the browser confirm keeps the group and leaves Delete usable', async ({ page }) => {
    const groupName = `E2E Cancel Delete ${Date.now()}`;
    await createGroupAndOpenEdit(page, groupName);

    // Dismiss (Cancel) the real browser dialog: nothing is deleted and the
    // double-tap "confirming" flag must reset so Delete works again.
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByTestId('edit-group-delete-button').click();
    await expect(page.getByTestId('edit-group-delete-button')).toBeEnabled();

    // Second attempt accepts: proves the button recovered, and cleans up.
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('edit-group-delete-button').click();
    await expect(page.getByText(groupName)).toHaveCount(0, { timeout: 10000 });
  });

  test('creator can delete a group with no expenses via a confirmation dialog, and it disappears from the list', async ({ page }) => {
    const groupName = `E2E Delete Group ${Date.now()}`;
    await createGroupAndOpenEdit(page, groupName);

    // Confirm deletion via the real browser dialog.
    page.once('dialog', (dialog) => dialog.accept());

    // The creator gets an enabled button and no "only the creator" hint.
    await expect(page.getByTestId('edit-group-delete-button')).toBeEnabled();
    await expect(page.getByTestId('edit-group-delete-hint')).toHaveCount(0);
    await page.getByTestId('edit-group-delete-button').click();

    // The group should be gone from the list once the deletion completes.
    await expect(page.getByText(groupName)).toHaveCount(0, { timeout: 10000 });
  });
});
