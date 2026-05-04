import { requireAuth } from '@/lib/auth/route-guard';
import { aggregateChatToolKpis, listMetrics } from '@/lib/api/metric-client';
import { ChatToolActivity } from '@/components/dashboard/chat-tool-activity';

const CHAT_KPI_LIMIT = 200;

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  const token = guard.accessToken;

  // Fan out the three KPI fetches in parallel; surface a soft "errored" state
  // if any one fails so the rest of the dashboard still renders.
  let chatToolErrored = false;
  let chatToolSummary = null;
  try {
    const [invocations, errors, sessions] = await Promise.all([
      listMetrics(token, { name: 'chat.tool.invocation_count', limit: CHAT_KPI_LIMIT }),
      listMetrics(token, { name: 'chat.tool.error_count', limit: CHAT_KPI_LIMIT }),
      listMetrics(token, { name: 'chat.session.with_tools_count', limit: CHAT_KPI_LIMIT }),
    ]);
    chatToolSummary = aggregateChatToolKpis({
      invocationRecords: invocations.records,
      errorRecords: errors.records,
      sessionRecords: sessions.records,
    });
  } catch {
    chatToolErrored = true;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">仪表盘</h1>
        <p className="mt-0.5 text-sm text-zinc-500">概览与数据一览</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: '活跃 Listing', value: '—' },
          { label: '待审核', value: '—' },
          { label: '本月广告支出', value: '—' },
          { label: '工单处理中', value: '—' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <ChatToolActivity summary={chatToolSummary} errored={chatToolErrored} />
    </div>
  );
}
