/**
 * Real E2E test for the intelligence-layer feature (Theme/Category/Label,
 * U1-U10) against a live backend + Postgres DB and a real rendered Expo
 * web app -- not mocks. Fills the coverage gap flagged in
 * PROJECT_MEMORY/05-QUALITY_STANDARDS.md's "real E2E coverage required"
 * rule (added 2026-09-14).
 *
 * Prerequisites (not started by this test -- see playwright.config.ts):
 *   - docker-compose postgres running
 *   - backend dev server running on :4000
 *   - `npx expo start --web` running on :8081
 *   - test user test@test.com / Test1234! seeded and email-verified
 *
 * Run: npx playwright test e2e/intelligence-layer.spec.ts
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'test@test.com';
const TEST_PASSWORD = 'Test1234!';
const API_BASE_URL = 'http://localhost:4000/api';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByTestId('email-input').fill(TEST_EMAIL);
  await page.getByTestId('password-input').fill(TEST_PASSWORD);
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 15000 });
}

test.describe('Intelligence layer: Theme, Category, Label, autocomplete (U1-U10)', () => {
  let createdExpenseId: number | null = null;

  // Hard-deletes the expense this test created. DELETE /api/groups/:id is
  // only a soft delete (deactivateGroup), and findSimilarExpenses's
  // accessible-groups query doesn't filter isActive -- so a deactivated
  // group's expense titles still pollute autocomplete matching for later
  // runs. Deleting the expense directly (a real hard delete) is what
  // actually keeps re-runs idempotent.
  test.afterEach(async ({ request }) => {
    if (createdExpenseId === null) {
      return;
    }
    const loginResponse = await request.post(`${API_BASE_URL}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    const { data } = await loginResponse.json();
    await request.delete(`${API_BASE_URL}/expenses/${createdExpenseId}`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    createdExpenseId = null;
  });

  test('create a group with a new Theme, add an expense whose title triggers the dictionary category suggestion, tag it with a new Label, then manage that Label', async ({ page }) => {
    const runId = Date.now();
    const groupName = `E2E Group ${runId}`;
    const themeName = `E2E Theme ${runId}`;
    const labelName = `E2E Label ${runId}`;
    const expenseTitle = `Taxi to the airport ${runId}`;

    page.on('response', async (response) => {
      if (response.url().includes('/api/expenses') && response.request().method() === 'POST') {
        const body = await response.json().catch(() => null);
        if (body?.data?.id) {
          createdExpenseId = body.data.id;
        }
      }
    });

    await login(page);

    // --- Create a group with a new Theme (U8, R1) ---
    await page.getByTestId('add-group-button').click();
    await page.getByTestId('group-name-input').fill(groupName);

    await page.getByTestId('group-theme-picker-button').click();
    await page.getByTestId('group-theme-add-new-button').click();
    await page.getByTestId('group-theme-create-input').fill(themeName);
    await page.getByTestId('group-theme-create-submit-button').click();
    // Dropdown closes and selection is reflected on the picker button itself.
    await expect(page.getByTestId('group-theme-picker-button')).toContainText(themeName);

    await page.getByTestId('create-button').click();

    // AddMemberModal opens after create; close it without inviting anyone.
    await expect(page.getByTestId('add-member-close-button')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('add-member-close-button').click();

    // Land back on Home; open the group we just created.
    await expect(page.getByText(groupName)).toBeVisible({ timeout: 10000 });
    await page.getByText(groupName).click();
    await expect(page.getByTestId('expense-list-screen')).toBeVisible({ timeout: 10000 });

    // --- Add an expense whose title has no history (no autocomplete match)
    // but hits the keyword dictionary, pre-selecting a category (U5/U6/U9,
    // R5/R8) ---
    await page.getByTestId('add-expense-button').click();
    await expect(page.getByTestId('edit-expense-title-input')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('edit-expense-title-input').fill(expenseTitle);
    // No past history exists for this brand-new group/user combination, so
    // the dictionary fallback should fire and pre-select Travel.
    await expect(page.getByTestId('edit-expense-category-picker-button')).toContainText('Travel', { timeout: 5000 });

    await page.getByTestId('edit-expense-amount-input').fill('42');

    // Tag it with a brand-new Label via "Add new" (U8, R7)
    await page.getByTestId('edit-expense-label-picker-button').click();
    await page.getByTestId('edit-expense-label-add-new-button').click();
    await page.getByTestId('edit-expense-label-create-input').fill(labelName);
    await page.getByTestId('edit-expense-label-create-submit-button').click();
    await expect(page.getByTestId('edit-expense-label-picker-button')).toContainText(labelName);

    // Pick who paid (required field) then save.
    await page.getByTestId('edit-expense-paid-by-picker-button').click();
    await page.locator('[data-testid^="edit-expense-paid-by-option-"]').first().click();

    await page.getByTestId('edit-expense-save-button').click();
    await expect(page.getByTestId('expense-list-screen')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(expenseTitle)).toBeVisible({ timeout: 10000 });

    // --- Manage Labels screen (U10, R4/R6): the new label appears with a
    // real spend total, then disabling it removes it from the list ---
    await page.goto('/');
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('home-manage-labels-button').click();
    await expect(page.getByText(labelName)).toBeVisible({ timeout: 10000 });
    const labelRow = page.locator('[data-testid^="manage-labels-row-"]').filter({ hasText: labelName });
    await expect(labelRow.getByText('42.00')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await labelRow.locator('[data-testid^="manage-labels-disable-"]').click();
    await expect(page.getByText(labelName)).not.toBeVisible({ timeout: 10000 });
  });
});
