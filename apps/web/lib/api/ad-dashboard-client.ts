import type { AdDashboardResponse } from '@yaemartos/shared-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface AdDashboardParams {
  brandId?: string;
  shopId?: string;
  adType?: string;
  startDate: string;
  endDate: string;
}

export async function fetchAdDashboard(
  accessToken: string,
  params: AdDashboardParams,
  brandId: string,
): Promise<AdDashboardResponse | null> {
  const qs = new URLSearchParams();
  if (params.brandId) {
    qs.set('brandId', params.brandId);
  }
  if (params.shopId) {
    qs.set('shopId', params.shopId);
  }
  if (params.adType) {
    qs.set('adType', params.adType);
  }
  qs.set('startDate', params.startDate);
  qs.set('endDate', params.endDate);

  const res = await fetch(`${API_BASE}/ads/dashboard?${qs.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-brand-id': brandId,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (res.status === 403) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`AdDashboard fetch failed: ${res.status}`);
  }
  return res.json() as Promise<AdDashboardResponse>;
}
