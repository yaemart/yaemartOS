const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type CategoryTemplate = {
  id: string;
  categoryId: string;
  locale: 'en' | 'es' | 'fr' | 'de' | 'it';
  titleTemplate: string | null;
  bulletsTemplate: unknown;
  descriptionGuide: string | null;
  specParams: unknown;
  featureWords: unknown;
  sellingPoints: unknown;
  faqTemplate: unknown;
  recipeTemplate: unknown;
};

export type CategoryItem = {
  id: string;
  brandId: string;
  parentId: string | null;
  name: string;
  slug: string;
  isActive: boolean;
  requiresRecipe: boolean;
  _count?: {
    products?: number;
  };
};

export type ProductItem = {
  id: string;
  brandId: string;
  categoryId: string;
  sku: string;
  title: string;
  description: string | null;
  category?: { id: string; name: string };
  contents?: Array<{ source: string }>;
  _count?: {
    listings?: number;
  };
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

export async function listCategories(
  accessToken: string,
  params: { page?: number; pageSize?: number; brandId?: string; search?: string } = {},
  brand?: string,
) {
  const query = new URLSearchParams();
  if (params.page) {
    query.set('page', String(params.page));
  }
  if (params.pageSize) {
    query.set('pageSize', String(params.pageSize));
  }
  if (params.brandId) {
    query.set('brandId', params.brandId);
  }
  if (params.search) {
    query.set('search', params.search);
  }
  return request<Paged<CategoryItem>>(
    `/categories${query.toString() ? `?${query.toString()}` : ''}`,
    accessToken,
    { brand },
  );
}

export async function createCategory(
  accessToken: string,
  input: {
    brandId: string;
    parentId?: string;
    name: string;
    slug: string;
    isActive?: boolean;
    requiresRecipe?: boolean;
  },
  brand?: string,
) {
  return request<CategoryItem>('/categories', accessToken, {
    method: 'POST',
    body: input,
    brand,
  });
}

export async function getCategory(accessToken: string, id: string, brand?: string) {
  return request<CategoryItem>(`/categories/${id}`, accessToken, { brand });
}

export async function getCategoryTemplate(
  accessToken: string,
  categoryId: string,
  locale: 'en' | 'es' | 'fr' | 'de' | 'it' = 'en',
  brand?: string,
) {
  return request<CategoryTemplate | null>(
    `/categories/${categoryId}/template?locale=${locale}`,
    accessToken,
    { brand },
  );
}

export async function upsertCategoryTemplate(
  accessToken: string,
  categoryId: string,
  payload: Record<string, unknown>,
  brand?: string,
) {
  return request<CategoryTemplate>(`/categories/${categoryId}/template`, accessToken, {
    method: 'PUT',
    brand,
    body: payload,
  });
}

export async function listProducts(
  accessToken: string,
  params: {
    page?: number;
    pageSize?: number;
    brandId?: string;
    categoryId?: string;
    search?: string;
    source?: string;
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
  if (params.brandId) {
    query.set('brandId', params.brandId);
  }
  if (params.categoryId) {
    query.set('categoryId', params.categoryId);
  }
  if (params.search) {
    query.set('search', params.search);
  }
  if (params.source) {
    query.set('source', params.source);
  }
  return request<Paged<ProductItem>>(
    `/products${query.toString() ? `?${query.toString()}` : ''}`,
    accessToken,
    { brand },
  );
}

export async function createProduct(
  accessToken: string,
  input: {
    brandId: string;
    categoryId: string;
    sku: string;
    title: string;
    description?: string;
    locale?: 'en' | 'es' | 'fr' | 'de' | 'it';
  },
  brand?: string,
) {
  return request<ProductItem & { contents?: Array<{ source: string }> }>('/products', accessToken, {
    method: 'POST',
    body: input,
    brand,
  });
}

export async function getProduct(accessToken: string, id: string, brand?: string) {
  return request<
    ProductItem & {
      contents: Array<{ id: string; locale: string; source: string; payload: unknown }>;
      listings: Array<{ id: string; status: string; language: string }>;
    }
  >(`/products/${id}`, accessToken, { brand });
}

export async function updateProduct(
  accessToken: string,
  id: string,
  body: Record<string, unknown>,
  brand?: string,
) {
  return request<ProductItem>(`/products/${id}`, accessToken, {
    method: 'PATCH',
    body,
    brand,
  });
}

export async function updateProductContent(
  accessToken: string,
  id: string,
  body: { locale: 'en' | 'es' | 'fr' | 'de' | 'it'; payload: unknown },
  brand?: string,
) {
  return request<{ id: string; source: string; payload: unknown }>(
    `/products/${id}/content`,
    accessToken,
    {
      method: 'PUT',
      body,
      brand,
    },
  );
}
