const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ListingItem = {
  id: string;
  productId: string;
  brandId: string;
  marketId: string;
  platformId: string;
  shopId: string;
  language: string;
  platformListingId: string;
  isPrimary: boolean;
  trafficStrategy: string;
  status: string;
  title: string | null;
  bullets: unknown;
  description: string | null;
  searchTerms: string | null;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; sku: string; title: string };
  _count?: { versions: number };
};

export type ListingVersionItem = {
  id: string;
  listingId: string;
  versionNumber: number;
  contentSnapshot: unknown;
  status: 'draft' | 'active' | 'archived';
  createdBy: string | null;
  createdAt: string;
  publishedAt: string | null;
};

type Paged<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
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
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
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

export async function listListings(
  accessToken: string,
  params: {
    page?: number;
    pageSize?: number;
    productId?: string;
    brandId?: string;
    status?: string;
  } = {},
  brand?: string,
) {
  const query = new URLSearchParams();
  if (params.page) {
    query.set('page', String(params.page));
  }
  if (params.pageSize) {
    query.set('pageSize', String(params.pageSize));
  }
  if (params.productId) {
    query.set('productId', params.productId);
  }
  if (params.brandId) {
    query.set('brandId', params.brandId);
  }
  if (params.status) {
    query.set('status', params.status);
  }
  return request<Paged<ListingItem>>(
    `/listings${query.toString() ? `?${query.toString()}` : ''}`,
    accessToken,
    { brand },
  );
}

export async function getListing(accessToken: string, id: string, brand?: string) {
  return request<ListingItem & { versions: ListingVersionItem[] }>(`/listings/${id}`, accessToken, {
    brand,
  });
}

export async function updateListing(
  accessToken: string,
  id: string,
  input: {
    status?: string;
    isPrimary?: boolean;
    trafficStrategy?: string;
    title?: string;
    description?: string;
    bullets?: string[];
    searchTerms?: string;
  },
  brand?: string,
) {
  return request<ListingItem>(`/listings/${id}`, accessToken, {
    method: 'PATCH',
    body: input,
    brand,
  });
}

export async function listVersions(accessToken: string, listingId: string, brand?: string) {
  return request<ListingVersionItem[]>(`/listings/${listingId}/versions`, accessToken, { brand });
}

export async function activateVersion(
  accessToken: string,
  listingId: string,
  versionNumber: number,
  brand?: string,
) {
  return request<ListingVersionItem>(
    `/listings/${listingId}/versions/${versionNumber}/activate`,
    accessToken,
    { method: 'PATCH', brand },
  );
}

export async function generateListingDraft(
  accessToken: string,
  listingId: string,
  input: {
    productTitle: string;
    productCategory: string;
    competitorUrls?: string[];
    manualSellingPoints?: string;
    categoryLexicon?: string[];
    lingxingKeywordSeed?: string[];
  },
  brand?: string,
) {
  return request<ListingVersionItem>(`/listings/${listingId}/generate`, accessToken, {
    method: 'POST',
    body: input,
    brand,
  });
}
