const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type AdSuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'executed' | 'expired';

export type AdActionType = 'increase_bid' | 'decrease_bid' | 'pause' | 'enable';

export type AdChangeStatus = 'executed' | 'rolled_back';

export interface AdSuggestion {
  id: string;
  batchId: string;
  shopId: string;
  brandId: string;
  campaignId: string;
  campaignName: string | null;
  adType: string;
  actionType: AdActionType;
  field: string;
  currentValue: string | null;
  suggestedValue: string | null;
  reason: string;
  status: AdSuggestionStatus;
  generatedBy: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdChange {
  id: string;
  suggestionId: string | null;
  shopId: string;
  brandId: string;
  campaignId: string;
  actionType: AdActionType;
  field: string;
  valueBefore: string | null;
  valueAfter: string | null;
  executedAt: string;
  executedBy: string | null;
  reversibleBefore: string;
  rolledBackAt: string | null;
  rolledBackBy: string | null;
  status: AdChangeStatus;
  metadata: Record<string, unknown> | null;
}

export interface ListResponse<T> {
  records: T[];
  total: number;
  page: number;
  limit: number;
}

function authHeaders(token: string, brandId: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-brand-id': brandId,
    'Content-Type': 'application/json',
  };
}

export async function listAdSuggestions(
  token: string,
  brandId: string,
  params: { shopId?: string; status?: AdSuggestionStatus; page?: number; limit?: number } = {},
): Promise<ListResponse<AdSuggestion>> {
  const qs = new URLSearchParams();
  if (params.shopId) {
    qs.set('shopId', params.shopId);
  }
  if (params.status) {
    qs.set('status', params.status);
  }
  if (params.page) {
    qs.set('page', String(params.page));
  }
  if (params.limit) {
    qs.set('limit', String(params.limit));
  }

  const res = await fetch(`${API_BASE}/ads/suggestions?${qs.toString()}`, {
    headers: authHeaders(token, brandId),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`listAdSuggestions failed: ${res.status}`);
  }
  return res.json();
}

export async function generateAdSuggestions(
  token: string,
  brandId: string,
  body: { shopId: string; startDate?: string; endDate?: string },
): Promise<{ batchId: string | null; count: number; message: string }> {
  const res = await fetch(`${API_BASE}/ads/suggestions/generate`, {
    method: 'POST',
    headers: authHeaders(token, brandId),
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    throw new Error('AI 调用频率超限，请稍后再试');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`generate failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function executeAdSuggestion(
  token: string,
  brandId: string,
  id: string,
): Promise<{ change: AdChange }> {
  const res = await fetch(`${API_BASE}/ads/suggestions/${id}/execute`, {
    method: 'POST',
    headers: authHeaders(token, brandId),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`execute failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function rejectAdSuggestion(
  token: string,
  brandId: string,
  id: string,
): Promise<AdSuggestion> {
  const res = await fetch(`${API_BASE}/ads/suggestions/${id}/reject`, {
    method: 'POST',
    headers: authHeaders(token, brandId),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`reject failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function listAdChanges(
  token: string,
  brandId: string,
  params: { shopId?: string; page?: number; limit?: number } = {},
): Promise<ListResponse<AdChange>> {
  const qs = new URLSearchParams();
  if (params.shopId) {
    qs.set('shopId', params.shopId);
  }
  if (params.page) {
    qs.set('page', String(params.page));
  }
  if (params.limit) {
    qs.set('limit', String(params.limit));
  }

  const res = await fetch(`${API_BASE}/ads/suggestions/changes?${qs.toString()}`, {
    headers: authHeaders(token, brandId),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`listAdChanges failed: ${res.status}`);
  }
  return res.json();
}

export async function rollbackAdChange(
  token: string,
  brandId: string,
  changeId: string,
): Promise<AdChange> {
  const res = await fetch(`${API_BASE}/ads/suggestions/changes/${changeId}/rollback`, {
    method: 'POST',
    headers: authHeaders(token, brandId),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`rollback failed: ${res.status} ${text}`);
  }
  return res.json();
}
