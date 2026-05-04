import { expect, test } from '@playwright/test';
import {
  applySessionToContext,
  disableRealtimeFlag,
  enableRealtimeFlag,
  getAdminCredentials,
  loginAsHomtoneAdmin,
} from './helpers/sse';

const API = 'http://127.0.0.1:4000';

/**
 * W47 P0-E browser-side coverage for the realtime layer.
 *
 * The HTTP-level SSE contract (auth, flag gate, brand isolation, event
 * delivery, heartbeat) is exercised in `w47-realtime-sse.spec.ts`. This
 * suite picks up the rest of the chain that only a real browser can
 * verify:
 *
 *   1. `applySessionToContext` plants both the BFF cookies (`ym_*`) and
 *      the API cookie (`ya_sid`), so the admin shell renders AND the
 *      browser-driven `EventSource` handshake against `:4000` succeeds.
 *   2. The `RealtimeProvider` in `admin-shell.tsx` opens a single SSE
 *      stream that `useEntityRevalidation` subscribes to.
 *   3. A `system-config` event triggered server-side by `settings.upsert`
 *      surfaces as the amber banner in `settings-tabs.tsx`, and clicking
 *      "应用" clears it.
 *
 * Together with the SSE contract suite + `use-entity-revalidation.spec.tsx`,
 * this is enough to declare the browser integration shipped: the same hook
 * + provider drives the listing-editor / ad-suggestion / shop-binding
 * banners, all of which differ only in copy and entity name. The
 * remaining listing / ad / shop scenarios are kept as `fixme`s with
 * concrete staging-data prerequisites — see the `W47 day 2 follow-up
 * (deferred)` block at the bottom.
 */
test.describe('W47 P0-E: Realtime browser banner (system-config)', () => {
  const creds = getAdminCredentials();
  test.skip(
    !creds,
    'SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping browser realtime E2E',
  );

  test('settings page surfaces banner within 5s of upsert and clears on apply', async ({
    browser,
    request,
  }) => {
    const session = await loginAsHomtoneAdmin(request);
    await enableRealtimeFlag(request, session.accessToken, session.brandId);

    const context = await browser.newContext();
    await applySessionToContext(context, session);
    const page = await context.newPage();

    try {
      // Wait for the SSE handshake request to leave the browser before we
      // publish — otherwise the upsert can race ahead of the subscribe and
      // the event lands while the bus is still mid-connect.
      const ssePending = page.waitForRequest(
        (req) => req.url().includes('/realtime/inbox') && req.method() === 'GET',
        { timeout: 10_000 },
      );
      await page.goto('/en/settings');
      // Confirm the admin shell rendered (we did not bounce to /login).
      await expect(page.getByRole('heading', { name: '系统设置' })).toBeVisible({
        timeout: 10_000,
      });
      await ssePending;

      // Brand-scoped probe key — backend `extractBrandFromKey` recognises the
      // `.homtone` suffix and emits exactly one targeted `system-config`
      // event into the live SSE channel (no global fan-out noise).
      const probeKey = `feature_flag.E2E_REALTIME_PROBE.${session.brandId}`;
      const upsert = await request.put(
        `${API}/settings/feature-flags/${encodeURIComponent(probeKey)}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'x-yaemart-brand': session.brandId,
          },
          data: { value: `${Date.now()}` },
        },
      );
      expect(upsert.status()).toBe(200);

      // Banner copy lives in `apps/web/components/settings/settings-tabs.tsx`.
      const banner = page.getByText('已修改系统配置');
      await expect(banner).toBeVisible({ timeout: 5_000 });

      // Click 「应用」 — `applyPending()` calls `dismissPending()` and bumps
      // `panelEpoch`, so the banner should disappear without a page reload.
      await page.getByRole('button', { name: '应用' }).click();
      await expect(banner).toBeHidden({ timeout: 2_000 });
    } finally {
      await context.close();
      await disableRealtimeFlag(request, session.accessToken, session.brandId);
    }
  });
});

/**
 * The remaining browser-driven scenarios sit on top of the same hook +
 * provider proven by the test above. They stay `fixme`'d until W48
 * staging seeds the necessary records — flipping them on without real
 * data would just exercise empty-state placeholders.
 *
 * Each entry documents the exact prerequisite, so picking them up in W48
 * is mechanical:
 *
 *   - listing toast → needs at least one product with a `draft` listing
 *     in the seeded brand so `/listings/[id]` renders the editor and
 *     `/listing/draft` POST publishes a `listing` event.
 *   - ad-suggestion ribbon → needs a Lingxing-bound shop with at least
 *     one ad campaign so `executeAdSuggestion` succeeds and produces an
 *     `ad-suggestion` event.
 *   - shop-binding banner → needs a bound shop the homtone admin can
 *     unbind (cross-tab assertion uses `unbind` to flip an existing
 *     binding, not create one).
 */
test.describe('W47 day 2 follow-up (deferred — staging data dependent)', () => {
  test.fixme('listing editor shows toast within 5s of agent draft', async () => {
    /*
     * Setup (W48 staging seed):
     *   1. seed a product with a `draft` listing in `homtone`.
     *   2. enable AGENT_NATIVE_REALTIME_UI flag.
     * Steps:
     *   - login + applySessionToContext.
     *   - page.goto('/en/listings/<id>'); wait for editor.
     *   - request.post('/listing/<id>/draft') with a benign edit.
     *   - expect 「已修改此 Listing」 visible ≤5s.
     *   - click 「应用」; expect banner hidden ≤2s.
     */
  });

  test.fixme('ad suggestion list auto-refreshes ribbon within 5s', async () => {
    /*
     * Setup:
     *   1. seed a Lingxing-bound shop with ≥1 paused campaign.
     *   2. enable AGENT_NATIVE_REALTIME_UI flag.
     * Steps:
     *   - login + applySessionToContext.
     *   - page.goto('/en/ads/suggestions'); wait for table.
     *   - request.post('/ads/suggestions') to generate.
     *   - expect 「刚刚收到新建议，已自动刷新」 visible ≤5s.
     *   - expect ribbon auto-hides ≤6s.
     */
  });

  test.fixme('shop binding banner appears on cross-tab unbind', async () => {
    /*
     * Setup:
     *   1. seed a shop bound to a Lingxing shopId in `homtone`.
     *   2. enable AGENT_NATIVE_REALTIME_UI flag.
     * Steps:
     *   - login + applySessionToContext.
     *   - page.goto('/en/shops'); wait for shop list.
     *   - request.put('/shops/<id>/binding') with `unbind=true`.
     *   - expect 「已修改店铺绑定」 visible ≤5s.
     *   - click 「刷新」; expect lingxingShopId column re-fetched.
     */
  });
});
