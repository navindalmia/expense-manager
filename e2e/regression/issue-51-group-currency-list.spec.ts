/**
 * E2E regression for GitHub issue #51: the currency list offered when
 * CREATING a group must match the list offered when EDITING a group (and the
 * backend's /currencies list).
 *
 * Prerequisites (not started by this test): backend on :4000, Expo web on the
 * baseURL, test user test@test.com / Test1234! seeded.
 */
import { test, expect, type Page } from '@playwright/test';

const EMAIL = 'test@test.com';
const PASSWORD = 'Test1234!';
const API = process.env.API_URL ?? 'http://localhost:4000/api';

async function login(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('email-input').fill(EMAIL);
  await page.getByTestId('password-input').fill(PASSWORD);
  await page.getByTestId('submit-button').click();
  await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 15000 });
}

async function optionCodes(page: Page, prefix: string): Promise<string[]> {
  const ids = await page
    .locator(`[data-testid^="${prefix}"]`)
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid') ?? ''));
  return ids.map((id) => id.slice(prefix.length)).sort();
}

test.describe('Group currency list is identical on create and edit (issue #51)', () => {
  let token = '';
  let groupId: number | null = null;

  test.afterEach(async ({ request }) => {
    if (groupId === null) return;
    // Soft-delete the group this test created.
    const res = await request.delete(`${API}/groups/${groupId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), 'cleanup delete-group API call should succeed').toBeTruthy();
    groupId = null;
  });

  test('create-group and edit-group show the same currencies as the backend', async ({ page, request }) => {
    const currenciesRes = await request.get(`${API}/currencies`);
    expect(currenciesRes.ok()).toBeTruthy();
    const backendCodes: string[] = ((await currenciesRes.json()).data as { code: string }[])
      .map((c) => c.code)
      .sort();

    const loginRes = await request.post(`${API}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
    expect(loginRes.ok()).toBeTruthy();
    token = (await loginRes.json()).data.token;

    const groupName = `E2E Currency ${Date.now()}`;
    const groupRes = await request.post(`${API}/groups`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: groupName, currency: 'GBP' },
    });
    expect(groupRes.ok()).toBeTruthy();
    groupId = (await groupRes.json()).data.id as number;

    await login(page);

    // EDIT view of the group created above
    await page.getByTestId(`edit-group-button-${groupId}`).click();
    await expect(page.getByTestId('edit-group-currency-option-GBP')).toBeVisible();
    const editCodes = await optionCodes(page, 'edit-group-currency-option-');
    await page.getByTestId('edit-group-cancel-button').click();
    await expect(page.getByTestId('edit-group-currency-option-GBP')).toHaveCount(0);

    // CREATE view
    await page.getByTestId('add-group-button').click();
    await expect(page.getByTestId('currency-GBP')).toBeVisible();
    const createCodes = await optionCodes(page, 'currency-');

    expect(editCodes).toEqual(backendCodes);
    expect(createCodes).toEqual(editCodes);
  });
});
