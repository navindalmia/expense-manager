/**
 * Real E2E for issue #44: editing a group's currency on the Home screen must
 * update the card immediately AND keep its computed totals (PATCH /groups/:id
 * does not return totalAmount/userPersonalTotal).
 *
 * Prerequisites: postgres, backend on :4000, `npx expo start --web` on :8081,
 * test user test@test.com / Test1234! seeded and verified.
 * Run: npx playwright test e2e/regression/issue-44-group-edit-currency.spec.ts
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const TEST_EMAIL = 'test@test.com';
const TEST_PASSWORD = 'Test1234!';
const API = 'http://localhost:4000/api';

test.describe('Group edit: currency sync (#44)', () => {
  let token = '';
  let groupId: number | null = null;
  let expenseId: number | null = null;

  async function authHeaders(request: APIRequestContext) {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    expect(res.ok(), 'login API call should succeed').toBeTruthy();
    const body = await res.json();
    token = body.data.token;
    return { Authorization: `Bearer ${token}` };
  }

  test.afterEach(async ({ request }) => {
    const headers = await authHeaders(request);
    if (expenseId !== null) {
      await request.delete(`${API}/expenses/${expenseId}`, { headers });
    }
    if (groupId !== null) {
      await request.delete(`${API}/groups/${groupId}`, { headers }); // soft delete
    }
    expenseId = null;
    groupId = null;
  });

  test('should show new currency and keep totals on the card right after saving edit', async ({ page, request }) => {
    const headers = await authHeaders(request);
    const name = `E2E Currency ${Date.now()}`;

    const groupRes = await request.post(`${API}/groups`, {
      headers,
      data: { name, currency: 'GBP' },
    });
    expect(groupRes.ok(), 'create-group API call should succeed').toBeTruthy();
    const group = (await groupRes.json()).data;
    groupId = group.id;

    const catsRes = await request.get(`${API}/categories`, { headers });
    expect(catsRes.ok(), 'categories API call should succeed').toBeTruthy();
    const cats = (await catsRes.json()).data;
    expect(cats.length, 'seeded categories are required for the setup expense').toBeGreaterThan(0);
    const me = (await (await request.get(`${API}/groups/${groupId}`, { headers })).json()).data.createdBy.id;
    const expRes = await request.post(`${API}/expenses`, {
      headers,
      data: {
        title: 'E2E currency expense',
        amount: 100,
        groupId,
        paidById: me,
        categoryId: cats[0].id,
        splitWithIds: [me],
        expenseDate: new Date().toISOString(),
      },
    });
    expect(expRes.ok(), 'create-expense API call should succeed').toBeTruthy();
    expenseId = (await expRes.json()).data.id;

    await page.goto('/');
    await page.getByTestId('email-input').fill(TEST_EMAIL);
    await page.getByTestId('password-input').fill(TEST_PASSWORD);
    await page.getByTestId('submit-button').click();
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 15000 });

    const card = page.getByTestId(`group-item-${groupId}`);
    await expect(card).toContainText('100.00 GBP', { timeout: 10000 });

    await page.getByTestId(`edit-group-button-${groupId}`).click();
    await page.getByTestId('edit-group-currency-option-EUR').click();
    await page.getByTestId('edit-group-save-button').click();

    // No manual refresh: card must reflect EUR and keep its totals.
    await expect(card).toContainText('100.00 EUR', { timeout: 10000 });
    await expect(card).toContainText('Your share: 100.00');
  });
});
