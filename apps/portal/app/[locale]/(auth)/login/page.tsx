'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AuthFormError } from '@/components/auth-form-error';
import { loginAction } from '@/app/actions/auth-actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-brand-primary py-2 text-sm font-medium text-white hover:bg-brand-primary-dark disabled:opacity-50"
    >
      {pending ? 'Signing in…' : 'Sign In'}
    </button>
  );
}

export default function LoginPage() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const boundAction = loginAction.bind(null, locale);
  const [state, action] = useFormState(boundAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg">
      <div className="w-full max-w-sm rounded-xl border bg-brand-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-brand-text">Sign In</h1>
        <p className="mb-6 text-sm text-brand-text-secondary">Access your customer account</p>

        <form action={action} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-text" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
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
              name="password"
              type="password"
              required
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              autoComplete="current-password"
            />
          </div>

          <AuthFormError message={state?.error} />

          <SubmitButton />
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
