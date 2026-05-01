import { redirect } from 'next/navigation';
import { getSession } from './session';
import { fetchMe } from '../api/auth-client';

export type GuardResult =
  | {
      status: 'authenticated';
      user: { id: string; email: string; brandId: string; role: string };
      accessToken: string;
    }
  | { status: 'unauthenticated' }
  | { status: 'forbidden' };

export async function requireAuth(locale: string): Promise<GuardResult> {
  const session = await getSession();
  if (!session) {
    return redirect(`/${locale}/login`);
  }

  try {
    const user = await fetchMe(session.accessToken);
    return { status: 'authenticated', user, accessToken: session.accessToken };
  } catch {
    return redirect(`/${locale}/login`);
  }
}
