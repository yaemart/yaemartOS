import Link from 'next/link';

interface TicketDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

const SENDER_LABELS: Record<string, string> = {
  customer: 'You',
  ai: 'AI Assistant',
  agent: 'Support Agent',
};

export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  const { locale, id } = await params;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Link
        href={`/${locale}/tickets`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Back to tickets
      </Link>

      <div className="border rounded-lg overflow-hidden">
        <div className="border-b px-4 py-3 bg-gray-50">
          <p className="text-xs text-gray-400">Ticket #{id}</p>
          <p className="font-medium text-sm mt-0.5">Loading…</p>
        </div>

        <div className="p-4 space-y-3 min-h-48">
          <p className="text-sm text-gray-400 text-center py-8">Loading messages…</p>
        </div>

        <div className="border-t p-4 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type a reply…"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { SENDER_LABELS };
