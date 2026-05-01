const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ShopBinding = {
  id: string;
  lingxingShopId: string;
  syncEnabled: boolean;
  bindingToken: string | null;
  boundAt: string;
};

export type ShopItem = {
  id: string;
  name: string;
  brandId: string;
  platform: string;
  binding: ShopBinding | null;
};

export type LingxingShop = {
  id: string;
  name: string;
  platform: string;
};

function authHeaders(accessToken: string, brand?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  if (brand) {
    headers['x-yaemart-brand'] = brand;
  }
  return headers;
}

async function request<T>(
  path: string,
  accessToken: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    brand?: string;
    body?: unknown;
  } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: authHeaders(accessToken, options.brand),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }

  return res.json();
}

export async function listShops(accessToken: string, brand?: string) {
  return request<ShopItem[]>('/shops', accessToken, { brand });
}

export async function listLingxingShops(accessToken: string, brand?: string) {
  return request<LingxingShop[]>('/shops/lingxing-available', accessToken, { brand });
}

export async function bindShop(
  accessToken: string,
  shopId: string,
  dto: { lingxingShopId: string; bindingToken?: string },
  brand?: string,
) {
  return request<ShopBinding>(`/shops/${shopId}/bind`, accessToken, {
    method: 'POST',
    body: dto,
    brand,
  });
}

export async function toggleSync(
  accessToken: string,
  shopId: string,
  syncEnabled: boolean,
  brand?: string,
) {
  return request<ShopBinding>(`/shops/${shopId}/binding`, accessToken, {
    method: 'PATCH',
    body: { syncEnabled },
    brand,
  });
}
