import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

test.describe('W4: Auth & Admin Shell', () => {
  test('unauthenticated GET /auth/me returns 401', async ({ request }) => {
    const res = await request.get(`${API}/auth/me`);
    expect(res.status()).toBe(401);
  });

  test('login with invalid credentials returns 401', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: 'nobody@test.com', password: 'wrong' },
    });
    expect(res.status()).toBe(401);
  });

  test('admin dashboard page loads under locale', async ({ page }) => {
    await page.goto('/en/dashboard');
    await expect(page.locator('body')).toBeVisible();
  });

  test('forbidden page renders 403 content', async ({ page }) => {
    await page.goto('/en/forbidden');
    await expect(page.getByText('没有访问此页面的权限')).toBeVisible();
  });
});
