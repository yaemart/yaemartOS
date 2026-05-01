import { test, expect } from '@playwright/test';

test.describe('W1 smoke', () => {
  test('API GET /health returns ok', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:4000/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('Next.js home renders under locale prefix', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('heading', { name: /yaemartOS/i })).toBeVisible();
  });
});
