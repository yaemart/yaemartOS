'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { AuthFormError } from '@/components/auth-form-error';
import { registerCustomer } from '@/lib/api/customer-api-client';

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await registerCustomer({ email, password, name: name || undefined });
      router.push(`/${locale}/verify-email?email=${encodeURIComponent(email)}&sent=true`);
    } catch (err) {
      const e = err as { message?: string; status?: number };
      setError(e.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg">
      <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-brand-text">Create Account</h1>
        <p className="mb-6 text-sm text-brand-text-secondary">Join us to start shopping</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-text" htmlFor="name">
              Name <span className="text-brand-text-secondary">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

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
            <label className="mb-1 block text-xs font-medium text-brand-text" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-brand-text-secondary">
          Already have an account?{' '}
          <Link href={`/${locale}/login`} className="text-brand-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
