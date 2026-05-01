import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

test.describe('W4: Elasticsearch health', () => {
  test('health endpoint includes search status', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('search');
    expect(['up', 'disabled', 'degraded', 'not_loaded']).toContain(body.search);
  });

  test('search/health endpoint returns status', async ({ request }) => {
    const res = await request.get(`${API}/search/health`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('status');
  });
});
