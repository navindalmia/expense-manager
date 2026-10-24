/**
 * Real E2E regression for issue #47 against a live backend + Postgres:
 * a soft-deleted group must be treated as non-existent. Before the shared
 * assertGroupActive guard, a member could still read a deleted group's stats
 * and expenses, and delete it again, while the app told them they had lost
 * access. Soft delete keeps the data for support recovery; it must never be
 * served to users.
 *
 * Prerequisites (not started by this test): postgres, backend on :4000, and
 * test user test@test.com / Test1234! seeded and email-verified.
 *
 * Run: npx playwright test e2e/regression/issue-47-deleted-group-inaccessible.spec.ts
 */

import { test, expect } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:4000/api';
const EMAIL = 'test@test.com';
const PASSWORD = 'Test1234!';

test.describe('Deleted group is inaccessible (issue #47)', () => {
  test('stats, expenses and a second delete all return 404 after the group is deleted', async ({ request }) => {
    const loginRes = await request.post(`${API}/auth/login`, { data: { email: EMAIL, password: PASSWORD } });
    expect(loginRes.ok()).toBeTruthy();
    const headers = { Authorization: `Bearer ${(await loginRes.json()).data.token}` };

    const groupRes = await request.post(`${API}/groups`, {
      headers,
      data: { name: `E2E Deleted Group ${Date.now()}`, currency: 'GBP' },
    });
    expect(groupRes.ok()).toBeTruthy();
    const groupId = (await groupRes.json()).data.id as number;

    // Reachable while the group is active.
    expect((await request.get(`${API}/groups/${groupId}/stats`, { headers })).ok()).toBeTruthy();
    expect((await request.get(`${API}/expenses/group/${groupId}`, { headers })).ok()).toBeTruthy();

    const deleteRes = await request.delete(`${API}/groups/${groupId}`, { headers });
    expect(deleteRes.status()).toBe(200);

    // Gone for every group-scoped read, and a repeat delete is "not found".
    expect((await request.get(`${API}/groups/${groupId}`, { headers })).status()).toBe(404);
    expect((await request.get(`${API}/groups/${groupId}/stats`, { headers })).status()).toBe(404);
    expect((await request.get(`${API}/expenses/group/${groupId}`, { headers })).status()).toBe(404);
    expect((await request.delete(`${API}/groups/${groupId}`, { headers })).status()).toBe(404);
  });
});
