import { expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

test.describe('W6: Product CRUD', () => {
  test('unauthenticated GET /products returns 401', async ({ request }) => {
    const res = await request.get(`${API}/products`);
    expect(res.status()).toBe(401);
  });

  test('unauthenticated POST /products returns 401', async ({ request }) => {
    const res = await request.post(`${API}/products`, {
      data: {
        brandId: 'homtone',
        categoryId: 'cat_x',
        sku: 'SKU-X',
        title: 'Demo Product',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('products page renders under locale route', async ({ page }) => {
    await page.goto('/en/products');
    await expect(page.locator('body')).toBeVisible();
  });
});
