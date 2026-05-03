'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listTickets,
  listWarranties,
  type Ticket,
  type Warranty,
} from '../../../../lib/api/customer-api-client';

interface AccountBlock {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

function BlockCard({ title, description, href, icon, badge }: AccountBlock) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-3 rounded-xl border p-5 hover:border-gray-400 transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--color-primary-soft, #f3f4f6)' }}
        >
          <span style={{ color: 'var(--color-primary, #1a1a1a)' }}>{icon}</span>
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

interface AccountPageProps {
  params: Promise<{ locale: string }>;
}

export default function AccountPage({ params }: AccountPageProps) {
  const [locale, setLocale] = useState('en');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);

  useEffect(() => {
    params.then(({ locale: l }) => setLocale(l));
  }, [params]);

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      return;
    }

    listTickets(token)
      .then(setTickets)
      .catch(() => {});

    listWarranties(token)
      .then(setWarranties)
      .catch(() => {});
  }, []);

  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const activeWarranties = warranties.filter((w) => w.status === 'active');

  const blocks: AccountBlock[] = [
    {
      title: 'My Products',
      description: 'Browse products, view specs, and check warranty status.',
      href: `/${locale}/products`,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 3H8l-2 4h12l-2-4z" />
        </svg>
      ),
      badge: activeWarranties.length,
    },
    {
      title: 'My Tickets',
      description: 'View and manage your support requests.',
      href: `/${locale}/tickets`,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      ),
      badge: openTickets.length,
    },
    {
      title: 'Resources',
      description: 'Download product manuals in EN, ES, and FR.',
      href: `/${locale}/manuals`,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      title: 'Order Status',
      description: 'Check your order status without logging in.',
      href: `/${locale}/order-status`,
      icon: (
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto p-4 pb-16">
      <div className="mb-8">
        <h1 className="text-xl font-semibold mb-1">My Account</h1>
        <p className="text-sm text-gray-500">Welcome back. What can we help you with today?</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {blocks.map((block) => (
          <BlockCard key={block.title} {...block} />
        ))}
      </div>

      <div className="mt-8 border rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Register your warranty</p>
          <p className="text-xs text-gray-500 mt-0.5">Protect your recent purchase</p>
        </div>
        <Link
          href={`/${locale}/warranty/new`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-primary, #1a1a1a)' }}
        >
          Register
        </Link>
      </div>
    </div>
  );
}
