import { NextResponse } from 'next/server';
import { clearSessionCookieNames } from '@/lib/auth/session';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  for (const name of clearSessionCookieNames()) {
    response.cookies.delete(name);
  }

  return response;
}
