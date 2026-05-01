import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

test.describe('W4: Brand / Tenant switching', () => {
  test('invalid brand header returns 400', async ({ request }) => {
    const res = await request.get(`${API}/health`, {
      headers: { 'x-yaemart-brand': 'invalid_brand_xyz' },
    });
    expect(res.status()).toBe(400);
  });

  test('valid brand header is accepted', async ({ request }) => {
    const res = await request.get(`${API}/health`, {
      headers: { 'x-yaemart-brand': 'homtone' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.tenant).toBe('homtone');
  });

  test('brand switches correctly in health response', async ({ request }) => {
    for (const brand of ['homtone', 'spoonlemon', 'davivy', 'tysun']) {
      const res = await request.get(`${API}/health`, {
        headers: { 'x-yaemart-brand': brand },
      });
      const body = await res.json();
      expect(body.tenant).toBe(brand);
    }
  });
});
