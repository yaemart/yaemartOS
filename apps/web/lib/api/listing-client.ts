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

export type ListingMatrixEntry = {
  id: string;
  title: string | null;
  platformCode: string;
  platformName: string;
  shopName: string;
  trafficStrategy: string;
  isPrimary: boolean;
  status: string;
  language: string;
};

export type ListingMatrixResult = {
  listings: ListingMatrixEntry[];
  similarityMatrix: Record<string, Record<string, number>>;
  strategyDistribution: Record<string, number>;
  salesAvailableFrom: 'S4';
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

export async function getListingMatrix(
  accessToken: string,
  productId: string,
  brand?: string,
  signal?: AbortSignal,
): Promise<ListingMatrixResult> {
  const res = await fetch(
    `${API_BASE}/listings/matrix?productId=${encodeURIComponent(productId)}`,
    {
      headers: authHeaders(accessToken, brand),
      cache: 'no-store',
      signal,
    },
  );
  if (!res.ok) {
    throw new Error(`/listings/matrix failed: ${res.status}`);
  }
  return res.json();
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

// ---------------------------------------------------------------------------
// W29-W30: Multi-language batch generation types and API calls
// ---------------------------------------------------------------------------

export type LocaleInfo = {
  language: string;
  isPrimary: boolean;
  /** Display label, e.g. "EN", "ES", "FR" */
  label: string;
};

export type BatchGenerateTarget = {
  shopId: string;
  platformCode: string;
  platformListingId: string;
  competitorUrls?: string[];
  manualSellingPoints?: string;
  categoryLexicon?: string[];
  lingxingKeywordSeed?: string[];
};

export type BatchGenerateResult = {
  listingId: string | null;
  shopId: string;
  platformCode: string;
  language: string;
  versionNumber: number | null;
  status: 'completed' | 'failed';
  error?: string;
};

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  it: 'IT',
};

/**
 * Fetches active locales for a given market from `GET /locales?marketId=xxx`.
 * Returns locales with display labels (e.g. "EN", "ES", "FR").
 */
export async function fetchMarketLocales(
  accessToken: string,
  marketId: string,
  brand?: string,
): Promise<LocaleInfo[]> {
  const data = await request<{ locales: { language: string; isPrimary: boolean }[] }>(
    `/locales?marketId=${encodeURIComponent(marketId)}`,
    accessToken,
    { brand },
  );
  return data.locales.map((l) => ({
    language: l.language,
    isPrimary: l.isPrimary,
    label: LOCALE_LABELS[l.language] ?? l.language.toUpperCase(),
  }));
}

/**
 * Calls `POST /listings/batch-generate` with an array of languages and targets.
 * Returns per-combo results (status 'completed' or 'failed').
 */
export async function batchGenerateMultilingual(
  accessToken: string,
  payload: {
    productId: string;
    brandId: string;
    marketId: string;
    productTitle: string;
    productCategory: string;
    languages: string[];
    targets: BatchGenerateTarget[];
  },
  brand?: string,
): Promise<{ results: BatchGenerateResult[] }> {
  return request<{ results: BatchGenerateResult[] }>('/listings/batch-generate', accessToken, {
    method: 'POST',
    body: payload,
    brand,
  });
}

/**
 * Fetches all listings for the same product/shop/platform combination,
 * used to discover "sibling" listings in other languages.
 */
export async function fetchSiblingListings(
  accessToken: string,
  params: { productId: string; shopId: string; platformId: string },
  brand?: string,
): Promise<{ id: string; language: string }[]> {
  const query = new URLSearchParams({
    productId: params.productId,
    shopId: params.shopId,
    platformId: params.platformId,
    pageSize: '20',
  });
  const data = await request<Paged<ListingItem>>(`/listings?${query.toString()}`, accessToken, {
    brand,
  });
  return data.data.map((l) => ({ id: l.id, language: l.language }));
}
