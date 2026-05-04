#!/usr/bin/env -S pnpm exec tsx
/**
 * W49 Staging Smoke — `chat.tool.*` KPI pipeline & dashboard widget
 *
 * Designed to be run on the first business morning of the W49 staging
 * canary (per [W49 brief](../../docs/briefs/2026-05-W49-leadership-sync.md))
 * to confirm that:
 *
 *   1. A real chat session against staging successfully reaches `streamText`
 *      with tools mounted (proves `AGENT_NATIVE_TOOL_CALLING.<brand>` flag is on).
 *   2. The three KPI metrics actually appear in the public `Metric` table
 *      (`chat.tool.invocation_count`, `chat.tool.error_count`,
 *      `chat.session.with_tools_count`).
 *   3. The admin dashboard SSR continues to render the
 *      "客服 Chat Tool 活动" widget block (proves the metric→UI loop closes).
 *
 * Usage
 * -----
 * ```bash
 * STAGING_API_BASE=https://staging-api.yaemartos.com \
 * STAGING_BRAND=homtone \
 * STAGING_ADMIN_TOKEN=$(cat ./.staging-admin-jwt) \
 * # optional — when set, smoke uses an authenticated chat path which
 * # exercises the happy-path tool result; without it the anonymous path
 * # is exercised, which still bumps invocation_count + error_count.
 * STAGING_CUSTOMER_TOKEN=$(cat ./.staging-customer-jwt) \
 * # optional — set to also smoke-test the dashboard SSR.
 * STAGING_DASHBOARD_URL=https://staging.yaemartos.com/zh-CN/dashboard \
 * STAGING_DASHBOARD_COOKIE=$(cat ./.staging-admin-cookie) \
 *   pnpm smoke:chat-tool
 * ```
 *
 * Exit codes
 * ----------
 *  - 0  All hard assertions passed.
 *  - 1  Hard assertion failed (HTTP error, no metric delta, etc.).
 *  - 2  Configuration error (missing required env var).
 *
 * Hard vs. soft assertions
 * ------------------------
 * Hard assertions cause exit 1; soft assertions are warned but do not
 * fail the run. This keeps the smoke usable both pre- and post-flag-flip,
 * letting ops watch the soft warnings flip green over the W49 week.
 */

import { setTimeout as sleep } from 'node:timers/promises';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

interface MetricRecord {
  id: string;
  name: string;
  // Prisma `Decimal @db.Decimal(18, 6)` serializes to a JSON string on
  // the wire (e.g. `"1"`), but older numeric writers may still emit a
  // raw number — accept both, normalize via `Number()` before arithmetic.
  // See `/review` finding F-1.
  value: number | string;
  unit: string | null;
  brandId: string | null;
  recordedAt: string;
}
interface MetricListResponse {
  records: MetricRecord[];
  total: number;
}

interface SmokeReport {
  startedAt: string;
  finishedAt: string;
  apiBase: string;
  brand: string;
  authenticated: boolean;
  steps: SmokeStep[];
  metricDeltas: Record<string, number>;
  hardFailures: string[];
  softWarnings: string[];
  exitCode: 0 | 1 | 2;
}

interface SmokeStep {
  name: string;
  ok: boolean;
  durationMs: number;
  detail?: string;
}

class SmokeError extends Error {
  constructor(
    message: string,
    public readonly hard = true,
  ) {
    super(message);
  }
}

function envOrDie(key: string): string {
  const v = process.env[key];
  if (!v) {
    process.stderr.write(`✗ Missing required env var: ${key}\n`);
    process.exit(2);
  }
  return v;
}

const KPI_NAMES = [
  'chat.tool.invocation_count',
  'chat.tool.error_count',
  'chat.session.with_tools_count',
] as const;

const TOOL_TRIGGER_PROMPT =
  'Show me my open warranty registrations and recent support tickets, please.';

async function main(): Promise<void> {
  const apiBase = envOrDie('STAGING_API_BASE').replace(/\/$/, '');
  const brand = process.env['STAGING_BRAND'] ?? 'homtone';
  const adminToken = envOrDie('STAGING_ADMIN_TOKEN');
  const customerToken = process.env['STAGING_CUSTOMER_TOKEN'];
  const dashboardUrl = process.env['STAGING_DASHBOARD_URL'];
  const dashboardCookie = process.env['STAGING_DASHBOARD_COOKIE'];
  const timeoutMs = parseInt(process.env['STAGING_TIMEOUT_MS'] ?? '30000', 10);

  const startedAt = new Date().toISOString();
  const steps: SmokeStep[] = [];
  const hardFailures: string[] = [];
  const softWarnings: string[] = [];

  // 1. Capture baseline KPI counts -----------------------------------------
  const baselineSums = await timed(steps, 'baseline KPI fetch', () =>
    sumAllKpis(apiBase, adminToken, brand),
  ).catch((e: Error) => {
    hardFailures.push(`baseline KPI fetch failed: ${e.message}`);
    return null;
  });

  if (!baselineSums) {
    return finalize(
      steps,
      {},
      hardFailures,
      softWarnings,
      startedAt,
      apiBase,
      brand,
      !!customerToken,
      1,
    );
  }

  // 2. Open SSE stream + drive a chat conversation -------------------------
  let sessionId: string | null = null;
  try {
    sessionId = await timed(steps, 'create chat session', () =>
      createChatSession(apiBase, brand, customerToken),
    );
  } catch (e) {
    hardFailures.push(`create session: ${(e as Error).message}`);
    return finalize(
      steps,
      {},
      hardFailures,
      softWarnings,
      startedAt,
      apiBase,
      brand,
      !!customerToken,
      1,
    );
  }

  const sseDrain = drainSse(apiBase, brand, sessionId, customerToken, timeoutMs);
  await timed(steps, 'send tool-trigger message', () =>
    sendChatMessage(apiBase, brand, sessionId!, TOOL_TRIGGER_PROMPT, customerToken),
  ).catch((e: Error) => hardFailures.push(`send message: ${e.message}`));

  const sseEvents = await sseDrain.catch((e: Error) => {
    softWarnings.push(`SSE drain timed out / failed: ${e.message}`);
    return [] as unknown[];
  });
  steps.push({
    name: 'SSE drain',
    ok: sseEvents.length > 0,
    durationMs: 0,
    detail: `${sseEvents.length} events received`,
  });

  // 3. Allow fire-and-forget metric writes to settle -----------------------
  await sleep(3000);

  // 4. Capture post-state and diff ----------------------------------------
  const postSums = await timed(steps, 'post-state KPI fetch', () =>
    sumAllKpis(apiBase, adminToken, brand),
  ).catch((e: Error) => {
    hardFailures.push(`post KPI fetch failed: ${e.message}`);
    return null;
  });

  const metricDeltas: Record<string, number> = {};
  if (postSums) {
    for (const name of KPI_NAMES) {
      metricDeltas[name] = postSums[name] - baselineSums[name];
    }

    // Hard: the session counter MUST bump — it's the proof the
    // tools-enabled streamText actually completed. (`onStepFinish` may
    // not fire if the LLM chose not to call any tool, hence the soft
    // treatment for invocation_count.)
    if (metricDeltas['chat.session.with_tools_count']! < 1) {
      hardFailures.push(
        `chat.session.with_tools_count did not bump (Δ=${metricDeltas['chat.session.with_tools_count']}). ` +
          `Likely root cause: AGENT_NATIVE_TOOL_CALLING.${brand} flag is OFF.`,
      );
    }
    if (metricDeltas['chat.tool.invocation_count']! < 1) {
      softWarnings.push(
        `chat.tool.invocation_count did not bump (Δ=${metricDeltas['chat.tool.invocation_count']}). ` +
          `LLM may have answered without calling a tool — adjust prompt or escalate to product.`,
      );
    }
  }

  // 5. (Optional) hit the admin dashboard and check the widget renders ----
  if (dashboardUrl && dashboardCookie) {
    await timed(steps, 'dashboard widget render', async () => {
      const html = await fetchDashboardHtml(dashboardUrl, dashboardCookie);
      const marker = '客服 Chat Tool 活动';
      if (!html.includes(marker)) {
        throw new SmokeError(`Dashboard HTML did not contain marker "${marker}"`);
      }
    }).catch((e: Error) => hardFailures.push(`dashboard SSR: ${e.message}`));
  } else {
    softWarnings.push(
      'Dashboard SSR not checked (set STAGING_DASHBOARD_URL + STAGING_DASHBOARD_COOKIE to enable).',
    );
  }

  return finalize(
    steps,
    metricDeltas,
    hardFailures,
    softWarnings,
    startedAt,
    apiBase,
    brand,
    !!customerToken,
    hardFailures.length === 0 ? 0 : 1,
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function timed<T>(steps: SmokeStep[], name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const out = await fn();
    steps.push({ name, ok: true, durationMs: Date.now() - start });
    return out;
  } catch (e) {
    steps.push({
      name,
      ok: false,
      durationMs: Date.now() - start,
      detail: (e as Error).message,
    });
    throw e;
  }
}

async function sumAllKpis(
  apiBase: string,
  adminToken: string,
  brand: string,
): Promise<Record<(typeof KPI_NAMES)[number], number>> {
  const sums: Record<string, number> = {};
  for (const name of KPI_NAMES) {
    const params = new URLSearchParams({ name, brandId: brand, limit: '200' });
    const res = await fetch(`${apiBase}/metrics?${params.toString()}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!res.ok) {
      throw new Error(`${name}: HTTP ${res.status}`);
    }
    const json = (await res.json()) as MetricListResponse;
    // F-1 fix: coerce `Decimal` wire string before summing so we never
    // accidentally string-concatenate (`0 + "1"` → `"01"`). See `/review`.
    sums[name] = json.records.reduce((acc, r) => {
      const n = typeof r.value === 'number' ? r.value : Number(r.value);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
  }
  return sums as Record<(typeof KPI_NAMES)[number], number>;
}

async function createChatSession(
  apiBase: string,
  brand: string,
  customerToken: string | undefined,
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-yaemart-brand': brand,
  };
  if (customerToken) {
    headers['Authorization'] = `Bearer ${customerToken}`;
  }
  const res = await fetch(`${apiBase}/customer/chat/sessions`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const json = (await res.json()) as { sessionId: string };
  if (!json.sessionId) {
    throw new Error('Response missing sessionId');
  }
  return json.sessionId;
}

async function sendChatMessage(
  apiBase: string,
  brand: string,
  sessionId: string,
  content: string,
  customerToken: string | undefined,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-yaemart-brand': brand,
  };
  if (customerToken) {
    headers['Authorization'] = `Bearer ${customerToken}`;
  }
  const res = await fetch(`${apiBase}/customer/chat/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content, locale: 'en' }),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
}

/**
 * Subscribe to the SSE endpoint via raw fetch streaming. Resolves with
 * the parsed events list once the stream emits `{ done: true }` or
 * `{ escalated: true }`, or rejects on timeout.
 *
 * Kicked off *before* `sendChatMessage` so we don't miss the first token.
 */
async function drainSse(
  apiBase: string,
  brand: string,
  sessionId: string,
  customerToken: string | undefined,
  timeoutMs: number,
): Promise<unknown[]> {
  const params = new URLSearchParams({ brand });
  const url = `${apiBase}/customer/chat/sessions/${sessionId}/stream?${params.toString()}`;
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (customerToken) {
    headers['Authorization'] = `Bearer ${customerToken}`;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const events: unknown[] = [];
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';
      for (const chunk of chunks) {
        const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) {
          continue;
        }
        try {
          const parsed = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>;
          events.push(parsed);
          if (parsed['done'] === true || parsed['escalated'] === true) {
            ctrl.abort();
            return events;
          }
        } catch {
          // ignore malformed lines
        }
      }
    }
    return events;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDashboardHtml(url: string, cookie: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Cookie: cookie, Accept: 'text/html' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

async function finalize(
  steps: SmokeStep[],
  metricDeltas: Record<string, number>,
  hardFailures: string[],
  softWarnings: string[],
  startedAt: string,
  apiBase: string,
  brand: string,
  authenticated: boolean,
  exitCode: 0 | 1 | 2,
): Promise<void> {
  const finishedAt = new Date().toISOString();
  const report: SmokeReport = {
    startedAt,
    finishedAt,
    apiBase,
    brand,
    authenticated,
    steps,
    metricDeltas,
    hardFailures,
    softWarnings,
    exitCode,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  await persistReport(report).catch(() => {
    // disk write is best-effort; CI may not have write access
  });

  // Pretty banner
  const banner =
    exitCode === 0
      ? '\n✅ W49 chat-tool smoke PASSED'
      : exitCode === 1
        ? '\n❌ W49 chat-tool smoke FAILED'
        : '\n⚠ W49 chat-tool smoke ABORTED (config)';
  process.stderr.write(`${banner}\n`);
  for (const w of softWarnings) {
    process.stderr.write(`  ⚠ ${w}\n`);
  }
  for (const f of hardFailures) {
    process.stderr.write(`  ✗ ${f}\n`);
  }

  process.exit(exitCode);
}

async function persistReport(report: SmokeReport): Promise<void> {
  const dir = resolve(process.cwd(), 'docs/reports/staging-smoke');
  await mkdir(dir, { recursive: true });
  const filename = `chat-tool-${report.brand}-${report.startedAt.replace(/[:.]/g, '-')}.json`;
  await writeFile(resolve(dir, filename), JSON.stringify(report, null, 2), 'utf8');
}

main().catch((e: Error) => {
  process.stderr.write(`Fatal: ${e.message}\n`);
  process.exit(1);
});
