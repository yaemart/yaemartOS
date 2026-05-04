/**
 * Thin client for the admin `/metrics` endpoint
 * (see `apps/api/src/metric/metric.controller.ts`).
 *
 * Used by the admin dashboard to surface the W49 chat-tool KPIs
 * (`chat.tool.invocation_count`, `chat.tool.error_count`,
 * `chat.session.with_tools_count`). See
 * [`docs/briefs/2026-05-W49-leadership-sync.md`](../../../docs/briefs/2026-05-W49-leadership-sync.md).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface MetricRecord {
  id: string;
  name: string;
  /**
   * Prisma serializes `Decimal @db.Decimal(18, 6)` as a JSON string
   * (e.g. `"1"` or `"1.000000"`), so the wire shape is `string`. Older
   * call sites that wrote numeric `Metric.value` may also surface as
   * `number`, so we accept both — always normalize via `Number(r.value)`
   * before arithmetic. See `/review` finding F-1.
   */
  value: number | string;
  unit: string | null;
  brandId: string | null;
  recordedAt: string;
}

export interface MetricListResponse {
  records: MetricRecord[];
  total: number;
}

/**
 * Fetch the most recent metric points by name. The backend caps `limit`
 * at 200 — pulling that many counter rows covers ~24h of moderate traffic
 * for the chat-tool KPIs.
 */
export async function listMetrics(
  token: string,
  options: { name: string; brandId?: string; limit?: number; signal?: AbortSignal },
): Promise<MetricListResponse> {
  const params = new URLSearchParams({ name: options.name });
  if (options.brandId) {
    params.set('brandId', options.brandId);
  }
  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  const res = await fetch(`${API_BASE}/metrics?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: options.signal,
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to list metrics (${options.name}): ${res.status}`);
  }
  return res.json() as Promise<MetricListResponse>;
}

export interface ChatToolKpiSummary {
  /** Total tool invocations within the lookback window. */
  invocations: number;
  /** Tool calls that returned `{ ok: false }` (ADR-012 §D3). */
  errors: number;
  /** Tools-enabled chat sessions (denominator for call rate). */
  sessions: number;
  /** invocations / sessions; null when sessions === 0. */
  callRate: number | null;
  /** errors / invocations; null when invocations === 0. */
  errorRate: number | null;
  /** Per-brand invocation breakdown, sorted desc by count. */
  perBrand: Array<{ brandId: string; invocations: number; errors: number }>;
  /** Window used for aggregation (ISO timestamps). */
  windowStart: string;
  windowEnd: string;
}

/**
 * Aggregate raw metric records into the KPI summary that drives the
 * admin dashboard "Customer Chat Tool Activity" widgets. Pure function —
 * no I/O, easy to unit-test.
 */
export function aggregateChatToolKpis(input: {
  invocationRecords: MetricRecord[];
  errorRecords: MetricRecord[];
  sessionRecords: MetricRecord[];
  /** Defaults to 24h. */
  windowMs?: number;
  /** Defaults to `Date.now()`. */
  now?: number;
}): ChatToolKpiSummary {
  const windowMs = input.windowMs ?? 24 * 60 * 60 * 1000;
  const nowMs = input.now ?? Date.now();
  const cutoff = nowMs - windowMs;

  // F-1 fix: Prisma Decimal is wire-string `"1"`. Coerce on the way
  // in so `total += value` cannot string-concatenate (`0 + "1"` → `"01"`).
  // `Number(NaN)` short-circuits to 0 to keep the aggregator total-stable
  // when a malformed row sneaks through.
  function safeNumber(raw: number | string): number {
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  function sumWithin(records: MetricRecord[]): number {
    let total = 0;
    for (const r of records) {
      if (new Date(r.recordedAt).getTime() >= cutoff) {
        total += safeNumber(r.value);
      }
    }
    return total;
  }

  const invocations = sumWithin(input.invocationRecords);
  const errors = sumWithin(input.errorRecords);
  const sessions = sumWithin(input.sessionRecords);

  const perBrandMap = new Map<string, { invocations: number; errors: number }>();
  function bumpBrand(records: MetricRecord[], key: 'invocations' | 'errors') {
    for (const r of records) {
      if (new Date(r.recordedAt).getTime() < cutoff) {
        continue;
      }
      const id = r.brandId ?? '(none)';
      const current = perBrandMap.get(id) ?? { invocations: 0, errors: 0 };
      current[key] += safeNumber(r.value);
      perBrandMap.set(id, current);
    }
  }
  bumpBrand(input.invocationRecords, 'invocations');
  bumpBrand(input.errorRecords, 'errors');

  const perBrand = [...perBrandMap.entries()]
    .map(([brandId, v]) => ({ brandId, ...v }))
    .sort((a, b) => b.invocations - a.invocations);

  return {
    invocations,
    errors,
    sessions,
    callRate: sessions === 0 ? null : invocations / sessions,
    errorRate: invocations === 0 ? null : errors / invocations,
    perBrand,
    windowStart: new Date(cutoff).toISOString(),
    windowEnd: new Date(nowMs).toISOString(),
  };
}
