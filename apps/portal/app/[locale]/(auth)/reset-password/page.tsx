'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { AuthFormError } from '@/components/auth-form-error';
import { validateResetToken, resetPassword } from '@/lib/api/customer-api-client';

type TokenState = 'validating' | 'valid' | 'invalid';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const token = searchParams.get('token') ?? '';

  const [tokenState, setTokenState] = useState<TokenState>('validating');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenState('invalid');
      return;
    }

    validateResetToken(token)
      .then(() => setTokenState('valid'))
      .catch(() => setTokenState('invalid'));
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      router.push(`/${locale}/login?reset=success`);
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message ?? 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (tokenState === 'validating') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg">
        <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm text-center">
          <p className="text-sm text-brand-text-secondary">Validating reset link…</p>
        </div>
      </div>
    );
  }

  if (tokenState === 'invalid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg">
        <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm text-center">
          <h1 className="mb-2 text-xl font-bold text-brand-text">Link Expired</h1>
          <p className="mb-6 text-sm text-brand-text-secondary">
            This password reset link is invalid or has expired.
          </p>
          <Link
            href={`/${locale}/forgot-password`}
            className="inline-block rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-dark"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg">
      <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-brand-text">Reset Password</h1>
        <p className="mb-6 text-sm text-brand-text-secondary">Enter your new password below.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-text" htmlFor="newPassword">
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label
              className="mb-1 block text-xs font-medium text-brand-text"
              htmlFor="confirmPassword"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              autoComplete="new-password"
            />
          </div>

          <AuthFormError message={error} />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-primary py-2 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-50"
          >
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
