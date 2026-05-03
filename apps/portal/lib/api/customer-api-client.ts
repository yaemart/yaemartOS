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
  return request('/customer/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function loginCustomer(data: { email: string; password: string }): Promise<AuthTokens> {
  return request('/customer/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function verifyEmail(token: string): Promise<{ message: string }> {
  return request('/customer/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function resendVerification(email: string): Promise<{ message: string }> {
  return request('/customer/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return request('/customer/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function validateResetToken(token: string): Promise<{ valid: boolean }> {
  return request(`/customer/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
}

export function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return request('/customer/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export function refreshToken(refreshTokenValue: string): Promise<AuthTokens> {
  return request('/customer/auth/refresh', {
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

export interface FaqItem {
  question: string;
  answer: string;
}

/** Matches the shape returned by ArticlePublicService.listProducts */
export interface ProductSummary {
  id: string;
  sku: string;
  slug: string;
  title: string;
  description: string;
  imageUrls: string[];
  locale: string;
  category: string;
}

export interface ProductListResult {
  data: ProductSummary[];
  total: number;
  page: number;
  limit: number;
}

/** Matches the shape returned by ArticlePublicService.getProduct */
export interface ProductDetail extends ProductSummary {
  faq: FaqItem[];
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
  return request(`/customer/products${qs ? `?${qs}` : ''}`);
}

export function getProduct(slug: string, locale?: string): Promise<ProductDetail> {
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : '';
  return request(`/customer/products/${encodeURIComponent(slug)}${query}`);
}

// ── Config ───────────────────────────────────────────────────────────────────

export function getPrivacyPolicy(locale: string): Promise<PrivacyPolicyResult> {
  return request(`/customer/config/privacy-policy?locale=${encodeURIComponent(locale)}`);
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatSession {
  sessionId: string;
  sessionToken: string;
}

export function createOrResumeChatSession(
  sessionToken?: string,
  accessToken?: string,
): Promise<ChatSession> {
  return request<ChatSession>('/customer/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ sessionToken }),
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}

export function sendChatMessage(
  sessionId: string,
  content: string,
  locale: string,
  accessToken?: string,
): Promise<{ sessionId: string; status: string }> {
  return request<{ sessionId: string; status: string }>(
    `/customer/chat/sessions/${sessionId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content, locale }),
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  );
}

/** Returns the SSE URL for streaming chat tokens. */
export function chatStreamUrl(sessionId: string): string {
  return `${API_BASE}/customer/chat/sessions/${sessionId}/stream`;
}

// ── Tickets ──────────────────────────────────────────────────────────────────

export interface Ticket {
  id: string;
  ticketNo: string;
  subject: string;
  status: string;
  priority: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  senderType: string;
  content: string;
  createdAt: string;
}

export interface TicketListResult {
  items: Ticket[];
  total: number;
  page: number;
  limit: number;
}

export function getTicket(ticketId: string, accessToken?: string): Promise<Ticket> {
  return request<Ticket>(`/customer/tickets/${ticketId}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}

export function getTickets(page = 1, accessToken?: string): Promise<TicketListResult> {
  return request<TicketListResult>(`/customer/tickets?page=${page}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}

export function listTickets(accessToken: string): Promise<Ticket[]> {
  return getTickets(1, accessToken).then((r) => r.items);
}

export function getTicketMessages(
  ticketId: string,
  accessToken?: string,
): Promise<TicketMessage[]> {
  return request<TicketMessage[]>(`/customer/tickets/${ticketId}/messages`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}

export function createTicket(
  data: { subject: string; initialMessage: string },
  accessToken: string,
): Promise<Ticket> {
  return request<Ticket>('/customer/tickets', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function addTicketMessage(
  ticketId: string,
  content: string,
  accessToken: string,
): Promise<TicketMessage> {
  return request<TicketMessage>(`/customer/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function closeTicket(ticketId: string, accessToken: string): Promise<Ticket> {
  return request<Ticket>(`/customer/tickets/${ticketId}/close`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ── Manuals ─────────────────────────────────────────────────────────────────

export interface ManualItem {
  productSku: string;
  locale: string;
  filename: string;
  secureUrl: string;
}

export function listManuals(sku?: string): Promise<ManualItem[]> {
  const query = sku ? `?sku=${encodeURIComponent(sku)}` : '';
  return request<ManualItem[]>(`/customer/manuals${query}`);
}

export function getManual(sku: string, locale: string): Promise<ManualItem> {
  return request<ManualItem>(
    `/customer/manuals/${encodeURIComponent(sku)}/${encodeURIComponent(locale)}`,
  );
}

// ── Warranties ──────────────────────────────────────────────────────────────

export interface Warranty {
  id: string;
  productSku: string;
  serialNumber: string;
  purchaseDate: string;
  platform?: string;
  warrantyExpiresAt?: string;
  status: string;
  registeredAt: string;
}

export function listWarranties(accessToken: string): Promise<Warranty[]> {
  return request<Warranty[]>('/customer/warranties', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function getWarranty(warrantyId: string, accessToken: string): Promise<Warranty> {
  return request<Warranty>(`/customer/warranties/${warrantyId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function registerWarranty(
  data: FormData,
  locale: string,
  accessToken: string,
): Promise<{ id: string; warrantyExpiresAt: string; status: string }> {
  const res = fetch(`${API_BASE}/customer/warranties?locale=${locale}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-yaemart-brand': BRAND,
    },
    body: data,
  });
  return res.then((r) => {
    if (!r.ok) {
      return r.json().then((e) => Promise.reject(e));
    }
    return r.json();
  });
}

// ── Order Lookup ─────────────────────────────────────────────────────────────

export interface OrderLookupResult {
  found: true;
  orderNumber: string;
  status: string;
  trackingNumber: string | null;
  estimatedDelivery: string | null;
}

export interface OrderLookupNotFound {
  found: false;
  message: string;
}

export function lookupOrder(data: {
  orderNumber: string;
  turnstileToken: string;
}): Promise<OrderLookupResult | OrderLookupNotFound> {
  return request<OrderLookupResult | OrderLookupNotFound>('/customer/order-lookup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
