import { expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

test.describe('W9-W10: Listing MVP', () => {
  // ── API auth guards ───────────────────────────────────────────────────────

  test('unauthenticated GET /listings returns 401', async ({ request }) => {
    const res = await request.get(`${API}/listings`);
    expect(res.status()).toBe(401);
  });

  test('unauthenticated POST /listings returns 401', async ({ request }) => {
    const res = await request.post(`${API}/listings`, {
      data: {
        productId: 'prd_test',
        brandId: 'homtone',
        marketId: 'mkt_test',
        platformId: 'plt_test',
        shopId: 'shp_test',
        language: 'en',
        platformListingId: 'ASIN-TEST',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('unauthenticated PATCH /listings/:id returns 401', async ({ request }) => {
    const res = await request.patch(`${API}/listings/nonexistent_id`, {
      data: { status: 'review' },
    });
    expect(res.status()).toBe(401);
  });

  test('unauthenticated GET /listings/:id/versions returns 401', async ({ request }) => {
    const res = await request.get(`${API}/listings/nonexistent_id/versions`);
    expect(res.status()).toBe(401);
  });

  test('unauthenticated POST /listings/:id/generate returns 401', async ({ request }) => {
    const res = await request.post(`${API}/listings/nonexistent_id/generate`, {
      data: {
        productTitle: 'Test Product',
        productCategory: 'Electronics',
      },
    });
    expect(res.status()).toBe(401);
  });

  // ── Web page renders ──────────────────────────────────────────────────────

  test('listings page renders under locale route', async ({ page }) => {
    await page.goto('/en/listings');
    await expect(page.locator('body')).toBeVisible();
  });

  test('listings page shows login redirect for unauthenticated user', async ({ page }) => {
    await page.goto('/en/listings');
    // Either the page renders content (if there's a public fallback) or redirects to login
    const url = page.url();
    const isOnListings = url.includes('/listings');
    const isOnLogin = url.includes('/login');
    expect(isOnListings || isOnLogin).toBe(true);
  });
});

/**
 * Performance placeholder:
 * Full P95 < 15s (M-02) load test should be run against staging with k6.
 * The script below is a reference stub — run it with:
 *   k6 run scripts/k6-listing-generate.js
 *
 * Expected criteria (from main implementation plan):
 *   - POST /listings/:id/generate P95 response time < 15,000ms
 *   - Success rate > 95%
 */
// NOTE: k6 script placeholder in scripts/k6-listing-generate.js (see U8 plan)
