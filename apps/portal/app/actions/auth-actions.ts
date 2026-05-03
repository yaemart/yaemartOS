'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const BRAND = process.env.NEXT_PUBLIC_BRAND ?? 'homtone';

const ACCESS_COOKIE = 'portal_access_token';
const REFRESH_COOKIE = 'portal_refresh_token';

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yaemart-brand': BRAND,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw { status: res.status, ...(err as object) };
  }
  return res.json() as T;
}

function setAuthCookies(accessToken: string, refreshToken: string) {
  const jar = cookies();
  const isProd = process.env.NODE_ENV === 'production';
  jar.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15, // 15 min (matches JWT expiry)
  });
  jar.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function loginAction(
  locale: string,
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  try {
    const { accessToken, refreshToken } = await apiPost<{
      accessToken: string;
      refreshToken: string;
    }>('/customer/auth/login', { email, password });

    setAuthCookies(accessToken, refreshToken);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    if (e.status === 403) {
      return { error: 'Email not verified. Please check your inbox.' };
    }
    return { error: 'Invalid email or password.' };
  }

  redirect(`/${locale}/products`);
}

export async function logoutAction(locale: string): Promise<void> {
  const jar = cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect(`/${locale}/login`);
}

export async function refreshAccessTokenAction(): Promise<boolean> {
  const jar = cookies();
  const rt = jar.get(REFRESH_COOKIE)?.value;
  if (!rt) {
    return false;
  }

  try {
    const { accessToken, refreshToken } = await apiPost<{
      accessToken: string;
      refreshToken: string;
    }>('/customer/auth/refresh', { refreshToken: rt });

    setAuthCookies(accessToken, refreshToken);
    return true;
  } catch {
    jar.delete(ACCESS_COOKIE);
    jar.delete(REFRESH_COOKIE);
    return false;
  }
}
