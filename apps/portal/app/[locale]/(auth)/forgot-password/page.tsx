'use client';

import { useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AuthFormError } from '@/components/auth-form-error';
import { forgotPassword } from '@/lib/api/customer-api-client';

export default function ForgotPasswordPage() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
    } catch {
      // Always show success message to avoid leaking whether email exists
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg">
        <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm text-center">
          <div className="mb-3 text-3xl">✉</div>
          <h1 className="mb-2 text-xl font-bold text-brand-text">Check Your Email</h1>
          <p className="mb-6 text-sm text-brand-text-secondary">
            If an account with that email exists, you&apos;ll receive a password reset link shortly.
          </p>
          <Link href={`/${locale}/login`} className="text-sm text-brand-primary hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg">
      <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-brand-text">Forgot Password</h1>
        <p className="mb-6 text-sm text-brand-text-secondary">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-text" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <AuthFormError message={error} />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-primary py-2 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-brand-text-secondary">
          Remember your password?{' '}
          <Link href={`/${locale}/login`} className="text-brand-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
