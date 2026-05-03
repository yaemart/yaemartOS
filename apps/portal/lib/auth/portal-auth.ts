import { cookies } from 'next/headers';

const ACCESS_TOKEN_KEY = 'portal_access_token';
const REFRESH_TOKEN_KEY = 'portal_refresh_token';

const TOKEN_MAX_AGE_SECONDS = 60 * 60; // 1 hour
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function getAccessToken(): string | undefined {
  return cookies().get(ACCESS_TOKEN_KEY)?.value;
}

export function getRefreshToken(): string | undefined {
  return cookies().get(REFRESH_TOKEN_KEY)?.value;
}

export function setAuthCookies(accessToken: string, refreshToken: string): void {
  const jar = cookies();
  jar.set(ACCESS_TOKEN_KEY, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_MAX_AGE_SECONDS,
  });
  jar.set(REFRESH_TOKEN_KEY, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookies(): void {
  const jar = cookies();
  jar.delete(ACCESS_TOKEN_KEY);
  jar.delete(REFRESH_TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
