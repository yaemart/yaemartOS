'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AuthFormError } from '@/components/auth-form-error';
import { loginCustomer } from '@/lib/api/customer-api-client';

export default function LoginPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loginCustomer({ email, password });
      router.push(`/${locale}/products`);
      router.refresh();
    } catch (err) {
      const e = err as { message?: string; status?: number };
      setError(e.message ?? 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg">
      <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-brand-text">Sign In</h1>
        <p className="mb-6 text-sm text-brand-text-secondary">Access your customer account</p>

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

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-brand-text" htmlFor="password">
                Password
              </label>
              <Link
                href={`/${locale}/forgot-password`}
                className="text-xs text-brand-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              autoComplete="current-password"
            />
          </div>

          <AuthFormError message={error} />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-primary py-2 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-brand-text-secondary">
          Don&apos;t have an account?{' '}
          <Link href={`/${locale}/register`} className="text-brand-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
