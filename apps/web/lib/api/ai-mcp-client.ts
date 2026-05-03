/**
 * Frontend client for Lingxing MCP AI endpoints.
 * All calls require an operator access token and go through the NestJS backend
 * which enforces iam:write permission before proxying to the Lingxing MCP bridge.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function mcpPost<T>(
  path: string,
  accessToken: string,
  body: unknown,
  brand?: string,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(brand ? { 'x-yaemart-brand': brand } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`MCP API error ${res.status}`), { status: res.status, ...err });
  }
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface KeywordSuggestion {
  keyword: string;
  searchVolume?: number;
  competition?: string;
}

export interface KeywordSuggestionsResult {
  keywords: KeywordSuggestion[];
  asin?: string;
  marketplace?: string;
}

export interface ListingSummaryResult {
  asin: string;
  title?: string;
  bullets?: string[];
  description?: string;
  searchTerms?: string[];
}

export interface InventoryItem {
  sku: string;
  fnsku?: string;
  available: number;
  reserved?: number;
  inbound?: number;
  shopId: string;
}

export interface InventoryQueryResult {
  items: InventoryItem[];
  total: number;
}

// ── API Functions ──────────────────────────────────────────────────────────

/**
 * Fetches Lingxing keyword suggestions for an ASIN or product title.
 * Maps to POST /ai/mcp/keyword-suggestions (iam:write required).
 */
export function getKeywordSuggestions(
  accessToken: string,
  params: { shopId: string; asin?: string; keyword?: string },
  brand?: string,
): Promise<KeywordSuggestionsResult> {
  return mcpPost('/ai/mcp/keyword-suggestions', accessToken, params, brand);
}

/**
 * Fetches the Lingxing listing summary for an ASIN.
 * Maps to POST /ai/mcp/listing-summary (iam:write required).
 */
export function getListingSummaryMcp(
  accessToken: string,
  params: { shopId: string; asin: string },
  brand?: string,
): Promise<ListingSummaryResult> {
  return mcpPost('/ai/mcp/listing-summary', accessToken, params, brand);
}

/**
 * Queries FBA inventory snapshot for a shop.
 * Maps to POST /ai/mcp/query-inventory (iam:write required).
 */
export function queryInventory(
  accessToken: string,
  params: { shopId: string; skus?: string[] },
  brand?: string,
): Promise<InventoryQueryResult> {
  return mcpPost('/ai/mcp/query-inventory', accessToken, params, brand);
}
