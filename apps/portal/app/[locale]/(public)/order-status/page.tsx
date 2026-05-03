'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { lookupOrder, type OrderLookupResult } from '../../../../lib/api/customer-api-client';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback': () => void;
          'expired-callback': () => void;
        },
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

const STATUS_LABELS: Record<string, string> = {
  Pending: 'Order Pending',
  Processing: 'Processing',
  Shipped: 'Shipped',
  Delivered: 'Delivered',
  Cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Processing: 'bg-blue-100 text-blue-700',
  Shipped: 'bg-indigo-100 text-indigo-700',
  Delivered: 'bg-green-100 text-green-700',
  Cancelled: 'bg-gray-100 text-gray-600',
};

interface OrderStatusPageProps {
  params: Promise<{ locale: string }>;
}

export default function OrderStatusPage({ params: _params }: OrderStatusPageProps) {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState(false);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrderLookupResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initTurnstile = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }
    turnstileContainerRef.current = node;

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey || typeof window === 'undefined') {
      return;
    }

    const tryRender = () => {
      if (window.turnstile) {
        widgetIdRef.current = window.turnstile.render(node, {
          sitekey: siteKey,
          callback: (token) => {
            setTurnstileToken(token);
            setTurnstileError(false);
          },
          'error-callback': () => setTurnstileError(true),
          'expired-callback': () => setTurnstileToken(''),
        });
      } else {
        setTimeout(tryRender, 500);
      }
    };
    tryRender();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!turnstileToken) {
        setTurnstileError(true);
        return;
      }

      setLoading(true);
      setResult(null);
      setNotFound(false);
      setError(null);

      try {
        const res = await lookupOrder({ orderNumber, email, turnstileToken });

        if (res.found) {
          setResult(res);
        } else {
          setNotFound(true);
        }
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && 'status' in err) {
          const status = (err as { status: number }).status;
          if (status === 429) {
            setError('Too many requests. Please wait a minute and try again.');
          } else if (status === 403) {
            setError('CAPTCHA verification failed. Please refresh and try again.');
          } else {
            setError('Something went wrong. Please try again.');
          }
        } else {
          setError('Something went wrong. Please try again.');
        }

        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current);
          setTurnstileToken('');
        }
      } finally {
        setLoading(false);
      }
    },
    [orderNumber, email, turnstileToken],
  );

  return (
    <div className="max-w-lg mx-auto p-4 pb-16">
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />

      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1">Check Order Status</h1>
        <p className="text-sm text-gray-500">
          Enter your order number to check status without logging in.
        </p>
      </div>

      {!result && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              placeholder="e.g. 123-4567890-1234567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
              placeholder="The email used for your order"
            />
          </div>

          <div>
            <div ref={initTurnstile} className="min-h-[65px]" />
            {turnstileError && (
              <p className="text-xs text-red-600 mt-1">CAPTCHA failed. Please try again.</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !turnstileToken}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary, #1a1a1a)' }}
          >
            {loading ? 'Checking…' : 'Check Status'}
          </button>
        </form>
      )}

      {notFound && (
        <div className="rounded-xl border p-6 text-center space-y-3">
          <p className="font-medium text-sm">Order not found</p>
          <p className="text-xs text-gray-500">
            We could not find an order with that number. Please double-check and try again.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setNotFound(false)}
              className="text-sm text-blue-600 hover:underline"
            >
              Try again
            </button>
            <span className="text-gray-300">·</span>
            <Link href="/tickets/new" className="text-sm text-blue-600 hover:underline">
              Contact support
            </Link>
          </div>
        </div>
      )}

      {result && (
        <div className="rounded-xl border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500">Order #{result.orderNumber}</p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                STATUS_COLORS[result.status] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {STATUS_LABELS[result.status] ?? result.status}
            </span>
          </div>

          {result.trackingNumber && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Tracking</span>
              <span className="font-medium">{result.trackingNumber}</span>
            </div>
          )}

          {result.estimatedDelivery && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Est. Delivery</span>
              <span className="font-medium">{result.estimatedDelivery}</span>
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setOrderNumber('');
              setEmail('');
              setTurnstileToken('');
              if (window.turnstile && widgetIdRef.current) {
                window.turnstile.reset(widgetIdRef.current);
              }
            }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 pt-2"
          >
            Check another order
          </button>
        </div>
      )}
    </div>
  );
}
