import { cookies } from 'next/headers';

const ACCESS_TOKEN_KEY = 'ym_access_token';
const REFRESH_TOKEN_KEY = 'ym_refresh_token';

export async function getSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_KEY)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_KEY)?.value;
  if (!accessToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

export function setSessionCookies(
  accessToken: string,
  refreshToken: string,
): { name: string; value: string; options: Record<string, unknown> }[] {
  const shared = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  return [
    { name: ACCESS_TOKEN_KEY, value: accessToken, options: { ...shared, maxAge: 900 } },
    { name: REFRESH_TOKEN_KEY, value: refreshToken, options: { ...shared, maxAge: 14 * 86400 } },
  ];
}

export function clearSessionCookieNames(): string[] {
  return [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY];
}
