import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

test.describe('W4: Permission Guard', () => {
  test('GET /iam/capabilities without auth returns 401', async ({ request }) => {
    const res = await request.get(`${API}/iam/capabilities`);
    expect(res.status()).toBe(401);
  });

  test('protected endpoint without token returns 401', async ({ request }) => {
    const res = await request.get(`${API}/auth/me`);
    expect(res.status()).toBe(401);
  });
});
