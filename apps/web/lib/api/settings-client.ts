const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ConnectionHealth = {
  id: string;
  label: string;
  envKey: string;
  configured: boolean;
};

export type SystemConfig = {
  id: string;
  category: string;
  key: string;
  value: string;
  label: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export type AiCostSummary = {
  month: string;
  budgets: {
    geminiMonthlyUsd: number;
    glmMonthlyCny: number;
    alertThresholdPct: number;
  };
  spend: {
    geminiUsd: number;
    glmUsd: number;
    totalCalls: number;
    byModel: Array<{
      model: string;
      calls: number;
      estimatedCostUsd: string;
      promptTokens: number;
      completionTokens: number;
    }>;
  };
  alerts: {
    geminiOverBudget: boolean;
    glmOverBudget: boolean;
  };
};

export type BrandTheme = {
  id: string;
  name: string;
  slug: string;
  themeColor: string | null;
  logoUrl: string | null;
};

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function request<T>(
  path: string,
  accessToken: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    body?: unknown;
  } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: authHeaders(accessToken),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function getConnections(accessToken: string) {
  return request<ConnectionHealth[]>('/settings/connections', accessToken);
}

export async function getFeatureFlags(accessToken: string) {
  return request<SystemConfig[]>('/settings/feature-flags', accessToken);
}

export async function upsertFeatureFlag(
  accessToken: string,
  key: string,
  value: string,
  label?: string,
) {
  return request<SystemConfig>(`/settings/feature-flags/${key}`, accessToken, {
    method: 'PUT',
    body: { value, label },
  });
}

export async function getAiRouting(accessToken: string) {
  return request<SystemConfig[]>('/settings/ai-routing', accessToken);
}

export async function upsertAiRouting(
  accessToken: string,
  key: string,
  value: string,
  label?: string,
) {
  return request<SystemConfig>(`/settings/ai-routing/${key}`, accessToken, {
    method: 'PUT',
    body: { value, label },
  });
}

export async function getAiCost(accessToken: string) {
  return request<AiCostSummary>('/settings/ai-cost', accessToken);
}

export async function upsertAiBudget(accessToken: string, key: string, value: string) {
  return request<SystemConfig>(`/settings/ai-budget/${key}`, accessToken, {
    method: 'PUT',
    body: { value },
  });
}

export async function getBrands(accessToken: string) {
  return request<BrandTheme[]>('/settings/brands', accessToken);
}

export async function updateBrandTheme(
  accessToken: string,
  brandId: string,
  dto: { themeColor?: string; logoUrl?: string; name?: string },
) {
  return request<BrandTheme>(`/settings/brands/${brandId}`, accessToken, {
    method: 'PATCH',
    body: dto,
  });
}
