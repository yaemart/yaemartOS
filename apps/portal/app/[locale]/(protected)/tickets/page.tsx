import Link from 'next/link';
import type { Ticket } from '../../../../lib/api/customer-api-client';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

function TicketRow({ ticket, locale }: { ticket: Ticket; locale: string }) {
  return (
    <Link
      href={`/${locale}/tickets/${ticket.id}`}
      className="block border rounded-lg p-4 hover:border-blue-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{ticket.subject}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            #{ticket.ticketNo} · {new Date(ticket.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[ticket.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {STATUS_LABELS[ticket.status] ?? ticket.status}
        </span>
      </div>
    </Link>
  );
}

interface TicketsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TicketsPage({ params }: TicketsPageProps) {
  const { locale } = await params;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">My Tickets</h1>
        <Link
          href={`/${locale}/tickets/new`}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          New Ticket
        </Link>
      </div>

      <TicketListClient locale={locale} />
    </div>
  );
}

function TicketListClient({ locale }: { locale: string }) {
  const placeholder: Ticket[] = [];

  if (placeholder.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">No support tickets yet.</p>
        <p className="text-xs mt-1">
          Have a question?{' '}
          <Link href={`/${locale}/chat`} className="text-blue-500 underline">
            Chat with us
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {placeholder.map((ticket) => (
        <TicketRow key={ticket.id} ticket={ticket} locale={locale} />
      ))}
    </div>
  );
}
