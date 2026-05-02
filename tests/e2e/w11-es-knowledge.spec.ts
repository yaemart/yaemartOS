/**
 * W11 E2E Smoke Tests: ES Knowledge Base + Listing Draft + Keyword Corpus
 *
 * These tests verify:
 * 1. Auth guards on all new search endpoints
 * 2. /search/health returns a valid response (no ES connection required)
 * 3. /search/bootstrap, /search/listing-draft, /search/keywords require JWT
 * 4. /search/keywords/import requires JWT
 *
 * Full integration tests (bootstrap + write + search) are in scripts/test-e2e-local.sh w11.
 */
import { expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

test.describe('W11: ES Knowledge Base — auth guards', () => {
  test('GET /search/health returns 200 without auth', async ({ request }) => {
    const res = await request.get(`${API}/search/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // When ELASTICSEARCH_URL is not set, status is "disabled" — still 200
    expect(['up', 'degraded', 'disabled']).toContain(body.status);
  });

  test('POST /search/bootstrap without auth returns 401', async ({ request }) => {
    const res = await request.post(`${API}/search/bootstrap`);
    expect(res.status()).toBe(401);
  });

  test('GET /search/listing-draft without auth returns 401', async ({ request }) => {
    const res = await request.get(`${API}/search/listing-draft?q=test`);
    expect(res.status()).toBe(401);
  });

  test('GET /search/keywords without auth returns 401', async ({ request }) => {
    const res = await request.get(`${API}/search/keywords?q=eco`);
    expect(res.status()).toBe(401);
  });

  test('POST /search/keywords/import without auth returns 401', async ({ request }) => {
    const res = await request.post(`${API}/search/keywords/import`, {
      data: { items: [] },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('W11: ES Knowledge Base — response shape', () => {
  /**
   * When ELASTICSEARCH_URL is unset (CI / unit environment), search endpoints
   * that reach getClient() will throw 500.  Health should remain 200/disabled.
   */
  test('GET /search/health shape when disabled', async ({ request }) => {
    const res = await request.get(`${API}/search/health`);
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('status');
    }
  });
});
