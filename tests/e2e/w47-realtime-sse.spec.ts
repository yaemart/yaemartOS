import { expect, test } from '@playwright/test';
import {
  SSE_INBOX_URL,
  disableRealtimeFlag,
  enableRealtimeFlag,
  getAdminCredentials,
  loginAsHomtoneAdmin,
  subscribeSse,
} from './helpers/sse';

const API = 'http://127.0.0.1:4000';
const REALTIME_KEY = 'feature_flag.AGENT_NATIVE_REALTIME_UI';

/**
 * Realtime SSE end-to-end coverage for W47 P0-E. These tests do NOT open a
 * browser — the SSE channel is server-driven and faster to validate via
 * direct HTTP, leaving page-level toast assertions for the W47 day 2
 * follow-up suite (see `w47-realtime-toast.spec.ts.fixme`).
 *
 * Skips wholesale when SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD aren't set —
 * CI provides these via secrets, and local devs can opt-in by exporting
 * the same credentials they used for `pnpm seed`.
 */
test.describe('W47 P0-E: Realtime SSE inbox', () => {
  const creds = getAdminCredentials();
  test.skip(!creds, 'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping realtime E2E');

  test('unauthenticated GET /realtime/inbox returns 401', async ({ request }) => {
    const res = await request.get(SSE_INBOX_URL);
    expect(res.status()).toBe(401);
  });

  test('feature flag off → 403 Forbidden (FeatureFlagGuard)', async ({ request }) => {
    const session = await loginAsHomtoneAdmin(request);
    // seed.ts plants the flag as `false` everywhere; confirm guard rejects.
    await disableRealtimeFlag(request, session.accessToken, session.brandId);

    const stream = subscribeSse(SSE_INBOX_URL, { cookie: session.cookieHeader });
    try {
      const status = await stream.status;
      expect(status).toBe(403);
    } finally {
      await stream.stop();
    }
  });

  test('cross-brand subscription via ?brand=… is denied (403)', async ({ request }) => {
    const session = await loginAsHomtoneAdmin(request);
    await enableRealtimeFlag(request, session.accessToken, session.brandId);
    try {
      const stream = subscribeSse(SSE_INBOX_URL, {
        cookie: session.cookieHeader,
        brand: 'spoonlemon',
      });
      try {
        const status = await stream.status;
        expect(status).toBe(403);
      } finally {
        await stream.stop();
      }
    } finally {
      await disableRealtimeFlag(request, session.accessToken, session.brandId);
    }
  });

  test('authenticated subscriber receives system-config event after settings.upsert', async ({
    request,
  }) => {
    const session = await loginAsHomtoneAdmin(request);
    await enableRealtimeFlag(request, session.accessToken, session.brandId);

    const stream = subscribeSse(SSE_INBOX_URL, { cookie: session.cookieHeader });
    try {
      // Wait for the SSE handshake to actually complete before triggering
      // the mutation — otherwise the publish can race ahead of subscribe.
      const status = await stream.status;
      expect(status).toBe(200);

      // Trigger a no-op-ish settings.upsert on a brand-scoped key. The
      // service will publish exactly one `system-config` event because
      // the key carries a `.homtone` suffix.
      const probeKey = `${REALTIME_KEY}.${session.brandId}`;
      const res = await request.put(
        `${API}/settings/feature-flags/${encodeURIComponent(probeKey)}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'x-yaemart-brand': session.brandId,
          },
          data: { value: 'true' },
        },
      );
      expect(res.status()).toBe(200);

      const evt = await stream.waitFor(
        (e) =>
          e.type === 'system-config' &&
          typeof e.data === 'object' &&
          e.data !== null &&
          (e.data as { brandId?: string }).brandId === session.brandId,
        5_000,
      );
      const payload = evt.data as { entity: string; brandId: string; ids: string[] };
      expect(payload.entity).toBe('system-config');
      expect(payload.brandId).toBe(session.brandId);
      expect(payload.ids).toContain(probeKey);
    } finally {
      await stream.stop();
      await disableRealtimeFlag(request, session.accessToken, session.brandId);
    }
  });

  test('cross-brand isolation: spoonlemon mutation invisible to homtone subscriber', async ({
    request,
  }) => {
    const session = await loginAsHomtoneAdmin(request);
    await enableRealtimeFlag(request, session.accessToken, session.brandId);

    const stream = subscribeSse(SSE_INBOX_URL, { cookie: session.cookieHeader });
    try {
      const status = await stream.status;
      expect(status).toBe(200);

      // Brand-scoped key for *another* brand. The publisher will emit
      // exactly one event for `spoonlemon` and zero for `homtone`. We do
      // NOT assert the spoonlemon flag flip succeeded against IAM — the
      // homtone admin may or may not have cross-brand write rights — so
      // we only check that no spoonlemon-tagged event leaks through.
      const otherBrandKey = `${REALTIME_KEY}.spoonlemon`;
      await request
        .put(`${API}/settings/feature-flags/${encodeURIComponent(otherBrandKey)}`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'x-yaemart-brand': session.brandId,
          },
          data: { value: 'true' },
        })
        .catch(() => undefined);

      const captured = await stream.collect(2_000);
      const leaked = captured.events.filter(
        (e) =>
          typeof e.data === 'object' &&
          e.data !== null &&
          (e.data as { brandId?: string }).brandId === 'spoonlemon',
      );
      expect(leaked, 'no spoonlemon event should reach a homtone subscriber').toHaveLength(0);
    } finally {
      await stream.stop();
      await disableRealtimeFlag(request, session.accessToken, session.brandId);
    }
  });

  test('connection emits heartbeat keep-alive (within shortened 30s window)', async ({
    request,
  }) => {
    const session = await loginAsHomtoneAdmin(request);
    await enableRealtimeFlag(request, session.accessToken, session.brandId);

    const stream = subscribeSse(SSE_INBOX_URL, { cookie: session.cookieHeader });
    try {
      const status = await stream.status;
      expect(status).toBe(200);

      // Heartbeat fires every 25s; allow up to 30s. Keep this test
      // tagged `@slow` so suites can opt-out via grep when running fast
      // local cycles.
      const heartbeat = await stream.waitFor((e) => e.type === 'heartbeat', 30_000);
      expect(heartbeat.type).toBe('heartbeat');
    } finally {
      await stream.stop();
      await disableRealtimeFlag(request, session.accessToken, session.brandId);
    }
  });
});
