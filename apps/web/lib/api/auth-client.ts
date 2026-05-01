const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

type AuthUser = {
  id: string;
  email: string;
  brandId: string;
  role: string;
};

export async function login(email: string, password: string): Promise<TokenPair> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`);
  }
  return res.json();
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    throw new Error(`Refresh failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMe(accessToken: string, brand?: string): Promise<AuthUser> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (brand) {
    headers['x-yaemart-brand'] = brand;
  }
  const res = await fetch(`${API_BASE}/auth/me`, { headers });
  if (!res.ok) {
    throw new Error(`fetchMe failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchCapabilities(accessToken: string, brand?: string): Promise<string[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (brand) {
    headers['x-yaemart-brand'] = brand;
  }
  const res = await fetch(`${API_BASE}/iam/capabilities`, { headers });
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return data.capabilities ?? [];
}
