'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { verifyEmail, resendVerification } from '@/lib/api/customer-api-client';

type PageState = 'pending-sent' | 'verifying' | 'success' | 'error' | 'idle';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const token = searchParams.get('token');
  const sent = searchParams.get('sent') === 'true';
  const email = searchParams.get('email') ?? '';

  const [state, setState] = useState<PageState>(
    token ? 'verifying' : sent ? 'pending-sent' : 'idle',
  );
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      return;
    }

    setState('verifying');
    verifyEmail(token)
      .then(() => setState('success'))
      .catch((err: { message?: string }) => {
        setErrorMsg(err.message ?? 'Verification failed. The link may be expired or invalid.');
        setState('error');
      });
  }, [token]);

  async function handleResend() {
    if (!email || resendDone) {
      return;
    }
    setResendLoading(true);
    try {
      await resendVerification(email);
      setResendDone(true);
    } catch {
      // Silently ignore — avoid leaking whether email exists
      setResendDone(true);
    } finally {
      setResendLoading(false);
    }
  }

  if (state === 'verifying') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg">
        <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm text-center">
          <p className="text-sm text-brand-text-secondary">Verifying your email…</p>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg">
        <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm text-center">
          <div className="mb-3 text-3xl">✓</div>
          <h1 className="mb-2 text-xl font-bold text-brand-text">Email Verified</h1>
          <p className="mb-6 text-sm text-brand-text-secondary">
            Your email has been verified. You can now sign in.
          </p>
          <Link
            href={`/${locale}/login`}
            className="inline-block rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-dark"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg">
        <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm text-center">
          <h1 className="mb-2 text-xl font-bold text-brand-text">Verification Failed</h1>
          <p role="alert" className="mb-6 text-sm text-red-600">
            {errorMsg}
          </p>
          <Link href={`/${locale}/login`} className="text-sm text-brand-primary hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // pending-sent or idle
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg">
      <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm text-center">
        <div className="mb-3 text-3xl">✉</div>
        <h1 className="mb-2 text-xl font-bold text-brand-text">Check Your Email</h1>
        <p className="mb-6 text-sm text-brand-text-secondary">
          We sent a verification link to {email ? <strong>{email}</strong> : 'your email address'}.
          Please check your inbox and click the link to verify your account.
        </p>

        {email && (
          <button
            onClick={handleResend}
            disabled={resendLoading || resendDone}
            className="text-sm text-brand-primary hover:underline disabled:opacity-50"
          >
            {resendDone ? 'Email sent!' : resendLoading ? 'Sending…' : 'Resend verification email'}
          </button>
        )}

        <p className="mt-4 text-sm text-brand-text-secondary">
          <Link href={`/${locale}/login`} className="text-brand-primary hover:underline">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
