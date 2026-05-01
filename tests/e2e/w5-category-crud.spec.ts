import { expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

test.describe('W5: Category CRUD', () => {
  test('unauthenticated GET /categories returns 401', async ({ request }) => {
    const res = await request.get(`${API}/categories`);
    expect(res.status()).toBe(401);
  });

  test('unauthenticated POST /categories returns 401', async ({ request }) => {
    const res = await request.post(`${API}/categories`, {
      data: {
        brandId: 'homtone',
        name: '厨电·慢炖锅',
        slug: 'slow-cooker',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('categories page renders under locale route', async ({ page }) => {
    await page.goto('/en/categories');
    await expect(page.locator('body')).toBeVisible();
  });
});
