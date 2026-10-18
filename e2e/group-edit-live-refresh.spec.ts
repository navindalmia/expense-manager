/**
 * Real E2E test for issue #44 against a live backend + Postgres DB and a
 * real rendered Expo web app -- not mocks.
 *
 * Covers: editing a group (name/description/currency) via EditGroupModal
 * updates the HomeScreen group list immediately, with no manual
 * pull-to-refresh needed.
 *
 * Root cause (fixed in PR #60): groupService.updateGroup() returned the
 * raw { success, data, message } response envelope instead of unwrapping
 * it. HomeScreen.handleEditSuccess(updatedGroup) then compared
 * updatedGroup.id (always undefined) against each list item's id, so the
 * optimistic list-replace never matched anything -- the edited group kept
 * showing its old name/description/currency until the user manually
 * pulled to refresh.
 *
 * This test edits the group's NAME rather than currency (the currency
 * display in HomeScreen's group card has no dedicated testID to assert
 * against without also touching production code) -- both fields go
 * through the exact same updateGroup()/handleEditSuccess() code path this
 * bug was in, so name coverage is equivalent regression protection for
 * issue #44's actual root cause.
 *
 * Deferred at PR #60's commit time via an E2E-Exempt trailer: this
 * repo's e2e/ harness only existed on the (then-unmerged) PR #55 branch.
 * Added as the promised follow-up now that PR #55 has merged to master.
 *
 * Prerequisites (not started by this test -- see playwright.config.ts):
 *   - Postgres running with the schema migrated and seeded
 *   - backend dev server running on :4000
 *   - `npx expo start --web` running on :8081
 *   - test user test@test.com / Test1234! seeded and email-verified
 *
 * Run: npx playwright test e2e/group-edit-live-refresh.spec.ts
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

test.describe('Group edit reflects immediately without manual refresh (issue #44)', () => {
  test('editing a group name updates the HomeScreen list without a pull-to-refresh', async ({ page }) => {
    const runId = Date.now();
    const originalName = `E2E Refresh Group ${runId}`;
    const editedName = `E2E Refresh Group ${runId} EDITED`;

    await login(page);

    // Create a fresh group to edit.
    await page.getByTestId('add-group-button').click();
    await page.getByTestId('group-name-input').fill(originalName);
    await page.getByTestId('create-button').click();
    await expect(page.getByTestId('add-member-close-button')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('add-member-close-button').click();
    await expect(page.getByText(originalName)).toBeVisible({ timeout: 10000 });

    // Open Edit Group for the card we just created, scoped by its
    // group-item-<id> wrapper so this doesn't accidentally match another
    // group with a similar name from a prior run.
    const groupCard = page.locator('[data-testid^="group-item-"]').filter({ hasText: originalName });
    await groupCard.locator('[data-testid^="edit-group-button-"]').click();

    await expect(page.getByTestId('edit-group-name-input')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('edit-group-name-input').fill(editedName);
    await page.getByTestId('edit-group-save-button').click();

    // The modal closes once the save resolves.
    await expect(page.getByTestId('edit-group-name-input')).toHaveCount(0, { timeout: 10000 });

    // Bug (pre-fix): the list kept showing the OLD name until a manual
    // pull-to-refresh re-fetched from the server, because
    // handleEditSuccess's g.id === updatedGroup.id check always failed
    // against the unwrapped-incorrectly response. Assert the NEW name is
    // visible with no reload/refresh action taken -- this is the whole
    // point of the regression test.
    await expect(page.getByText(editedName)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(originalName, { exact: true })).toHaveCount(0);
  });
});
