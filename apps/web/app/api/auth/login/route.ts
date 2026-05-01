import { NextResponse, type NextRequest } from 'next/server';
import { login } from '@/lib/api/auth-client';
import { setSessionCookies } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  try {
    const tokens = await login(email, password);
    const response = NextResponse.json({ ok: true });

    for (const cookie of setSessionCookies(tokens.accessToken, tokens.refreshToken)) {
      response.cookies.set(cookie.name, cookie.value, cookie.options as any);
    }

    return response;
  } catch {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }
}
