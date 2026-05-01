import { expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

test.describe('W7: Lingxing Shop Binding', () => {
  test('unauthenticated GET /shops returns 401', async ({ request }) => {
    const res = await request.get(`${API}/shops`);
    expect(res.status()).toBe(401);
  });

  test('unauthenticated GET /shops/lingxing-available returns 401', async ({ request }) => {
    const res = await request.get(`${API}/shops/lingxing-available`);
    expect(res.status()).toBe(401);
  });

  test('unauthenticated POST /shops/:id/bind returns 401', async ({ request }) => {
    const res = await request.post(`${API}/shops/fake-id/bind`, {
      data: { lingxingShopId: 'test' },
    });
    expect(res.status()).toBe(401);
  });

  test('shops page renders under locale route', async ({ page }) => {
    await page.goto('/en/shops');
    await expect(page.locator('body')).toBeVisible();
  });
});
