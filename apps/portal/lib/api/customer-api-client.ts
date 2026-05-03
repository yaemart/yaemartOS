const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const BRAND = process.env.NEXT_PUBLIC_BRAND ?? 'homtone';

interface ApiError {
  status: number;
  message?: string;
  [key: string]: unknown;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-yaemart-brand': BRAND,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw { status: res.status, ...body } as ApiError;
  }
  return res.json() as Promise<T>;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function registerCustomer(data: RegisterInput): Promise<{ message: string }> {
  return request('/api/customer/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function loginCustomer(data: { email: string; password: string }): Promise<AuthTokens> {
  return request('/api/customer/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function verifyEmail(token: string): Promise<{ message: string }> {
  return request(`/api/customer/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: 'GET',
  });
}

export function resendVerification(email: string): Promise<{ message: string }> {
  return request('/api/customer/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return request('/api/customer/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function validateResetToken(token: string): Promise<{ valid: boolean }> {
  return request(`/api/customer/auth/validate-reset-token?token=${encodeURIComponent(token)}`, {
    method: 'GET',
  });
}

export function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return request('/api/customer/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export function refreshToken(refreshTokenValue: string): Promise<AuthTokens> {
  return request('/api/customer/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
  });
}

// ── Products ────────────────────────────────────────────────────────────────

export interface ProductListParams {
  locale?: string;
  page?: number;
  limit?: number;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
}

export interface ProductListResult {
  items: ProductSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface ProductDetail extends ProductSummary {
  description?: string;
  images: string[];
  stock: number;
  sku?: string;
  faq?: FaqItem[];
}

export interface PrivacyPolicyResult {
  content: string;
}

export function getProducts(params?: ProductListParams): Promise<ProductListResult> {
  const query = new URLSearchParams();
  if (params?.locale) {
    query.set('locale', params.locale);
  }
  if (params?.page != null) {
    query.set('page', String(params.page));
  }
  if (params?.limit != null) {
    query.set('limit', String(params.limit));
  }
  const qs = query.toString();
  return request(`/api/customer/products${qs ? `?${qs}` : ''}`);
}

export function getProduct(slug: string, locale?: string): Promise<ProductDetail> {
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : '';
  return request(`/api/customer/products/${encodeURIComponent(slug)}${query}`);
}

// ── Config ───────────────────────────────────────────────────────────────────

export function getPrivacyPolicy(locale: string): Promise<PrivacyPolicyResult> {
  return request(`/api/customer/config/privacy-policy?locale=${encodeURIComponent(locale)}`);
}
