import type { ChatToolKpiSummary } from '@/lib/api/metric-client';

interface ChatToolActivityProps {
  summary: ChatToolKpiSummary | null;
  /** Set true when the API request failed; widget still renders, but as a soft "no data". */
  errored?: boolean;
}

const NUMBER_FMT = new Intl.NumberFormat('en-US');

function formatRate(rate: number | null, suffix: 'x' | '%'): string {
  if (rate === null) {
    return '—';
  }
  if (suffix === '%') {
    return `${(rate * 100).toFixed(1)}%`;
  }
  return `${rate.toFixed(2)}x`;
}

function rateTone(rate: number | null, kind: 'call' | 'error'): string {
  if (rate === null) {
    return 'text-zinc-400';
  }
  if (kind === 'call') {
    // Healthy call rate (W49 brief): 0.3 – 2.5
    if (rate < 0.3 || rate > 2.5) {
      return 'text-amber-600';
    }
    return 'text-emerald-600';
  }
  // error rate: green ≤ 30%, amber > 30%
  return rate <= 0.3 ? 'text-emerald-600' : 'text-amber-600';
}

/**
 * "Customer Chat Tool Activity" widget block — renders the three W49
 * leadership KPIs from the public `Metric` table, plus a per-brand split.
 *
 * Pure presentational component; the parent server page handles data
 * fetching + aggregation via `aggregateChatToolKpis`.
 */
export function ChatToolActivity({ summary, errored = false }: ChatToolActivityProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-zinc-700">客服 Chat Tool 活动（近 24h）</h2>
        <p className="text-xs text-zinc-400">
          来源：<code className="font-mono">chat.tool.*</code> · 见{' '}
          <span className="underline decoration-dotted">W49 brief §2</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="工具调用次数"
          value={errored || !summary ? '—' : NUMBER_FMT.format(summary.invocations)}
          hint="invocation_count"
        />
        <KpiCard
          label="工具错误次数"
          value={errored || !summary ? '—' : NUMBER_FMT.format(summary.errors)}
          hint="error_count · ok:false"
        />
        <KpiCard
          label="启用 tool 的会话数"
          value={errored || !summary ? '—' : NUMBER_FMT.format(summary.sessions)}
          hint="with_tools_count（call rate 分母）"
        />
        <KpiCard
          label="Call rate / Error rate"
          value={
            errored || !summary ? (
              '—'
            ) : (
              <span className="space-x-2 text-2xl font-semibold tabular-nums">
                <span className={rateTone(summary.callRate, 'call')}>
                  {formatRate(summary.callRate, 'x')}
                </span>
                <span className="text-zinc-300">/</span>
                <span className={rateTone(summary.errorRate, 'error')}>
                  {formatRate(summary.errorRate, '%')}
                </span>
              </span>
            )
          }
          hint="健康区间：call 0.3–2.5x · error ≤ 30%"
        />
      </div>

      {summary && summary.perBrand.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-500">
            按品牌
          </div>
          <ul className="divide-y divide-zinc-100">
            {summary.perBrand.map((row) => {
              const brandErrorRate = row.invocations === 0 ? null : row.errors / row.invocations;
              return (
                <li
                  key={row.brandId}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="font-medium capitalize text-zinc-700">{row.brandId}</span>
                  <span className="space-x-3 tabular-nums text-zinc-500">
                    <span>{NUMBER_FMT.format(row.invocations)} calls</span>
                    <span className={rateTone(brandErrorRate, 'error')}>
                      err {formatRate(brandErrorRate, '%')}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {errored && <p className="text-xs text-amber-600">Metric API 暂不可达，已显示占位数据。</p>}
    </section>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{value}</div>
      {hint && <p className="mt-1 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}
