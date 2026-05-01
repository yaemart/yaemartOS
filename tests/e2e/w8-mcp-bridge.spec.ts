import { expect, test } from '@playwright/test';

const API = 'http://127.0.0.1:4000';

test.describe('W8: Lingxing MCP Bridge', () => {
  test('unauthenticated GET /ai/mcp/tools returns 401', async ({ request }) => {
    const res = await request.get(`${API}/ai/mcp/tools`);
    expect(res.status()).toBe(401);
  });

  test('unauthenticated POST /ai/mcp/query-inventory returns 401', async ({ request }) => {
    const res = await request.post(`${API}/ai/mcp/query-inventory`, {
      data: { shopId: 'shop-1', marketplaceId: 'ATVPDKIKX0DER' },
    });
    expect(res.status()).toBe(401);
  });

  test('unauthenticated POST /ai/mcp/listing-summary returns 401', async ({ request }) => {
    const res = await request.post(`${API}/ai/mcp/listing-summary`, {
      data: { asin: 'B09XYZ1234' },
    });
    expect(res.status()).toBe(401);
  });

  test('unauthenticated POST /ai/mcp/keyword-suggestions returns 401', async ({ request }) => {
    const res = await request.post(`${API}/ai/mcp/keyword-suggestions`, {
      data: { asin: 'B09XYZ1234' },
    });
    expect(res.status()).toBe(401);
  });
});
