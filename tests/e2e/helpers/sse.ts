import type { APIRequestContext, BrowserContext } from '@playwright/test';

/**
 * Realtime / SSE helpers for Playwright E2E.
 *
 * Centralises the cookie-based JWT login flow used by `/realtime/inbox`
 * and the flag-toggle dance required to exercise the channel without
 * leaking enabled state into other suites.
 *
 * Usage:
 *
 *   const session = await loginAsHomtoneAdmin(request);
 *   await enableRealtimeFlag(request, session.accessToken);
 *   const stream = subscribeSse('http://127.0.0.1:4000/realtime/inbox', {
 *     cookie: session.cookieHeader,
 *   });
 *   const events = await stream.collect({ timeoutMs: 3_000 });
 *   await stream.stop();
 *   await disableRealtimeFlag(request, session.accessToken);
 */

const API = 'http://127.0.0.1:4000';
const COOKIE_NAME = 'ya_sid';

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  cookieHeader: string;
  userId: string;
  brandId: string;
  email: string;
}

/**
 * Read SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from the environment. The
 * test suite expects them to match what `apps/api/prisma/seed.ts` planted
 * — without them the realtime tests silently degrade to skipped.
 */
export function getAdminCredentials(): { email: string; password: string } | null {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    return null;
  }
  return { email, password };
}

/**
 * Login flow: posts to `/auth/login` and harvests the HttpOnly `ya_sid`
 * cookie from `set-cookie` so the subsequent SSE handshake can echo it
 * back. The JSON body still returns the bearer token for non-SSE calls
 * (e.g. flipping the feature flag).
 */
export async function loginAsHomtoneAdmin(request: APIRequestContext): Promise<AdminSession> {
  const creds = getAdminCredentials();
  if (!creds) {
    throw new Error('SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD must be set to run realtime E2E.');
  }
  const res = await request.post(`${API}/auth/login`, {
    data: { email: creds.email, password: creds.password },
  });
  if (res.status() !== 200) {
    throw new Error(`Login failed (${res.status()}): ${await res.text()}`);
  }
  const body = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; brandId: string };
  };

  const setCookieRaw = res.headers()['set-cookie'] ?? '';
  const cookieHeader = parseSessionCookieHeader(setCookieRaw);
  if (!cookieHeader) {
    throw new Error(`Login OK but no ${COOKIE_NAME} cookie returned`);
  }

  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    cookieHeader,
    userId: body.user.id,
    brandId: body.user.brandId,
    email: body.user.email,
  };
}

/**
 * Extract a `ya_sid=...` `Cookie:` header from the raw `set-cookie` value
 * Playwright surfaces. Multiple cookies are joined with `\n` so we can't
 * use simple string ops without splitting first.
 */
function parseSessionCookieHeader(rawSetCookie: string): string | null {
  if (!rawSetCookie) {
    return null;
  }
  const lines = rawSetCookie.split(/\r?\n/);
  for (const line of lines) {
    const [pair] = line.split(';');
    if (!pair) {
      continue;
    }
    const eq = pair.indexOf('=');
    if (eq < 0) {
      continue;
    }
    const name = pair.slice(0, eq).trim();
    if (name === COOKIE_NAME) {
      return pair.trim();
    }
  }
  return null;
}

interface SseSubscribeOptions {
  /** Required: the `Cookie:` header carrying `ya_sid`. */
  cookie: string;
  /** Optional `?brand=` query override (used to test cross-brand denial). */
  brand?: string;
  /** Optional AbortSignal — defaults to a fresh internal controller. */
  signal?: AbortSignal;
}

export interface SseSubscription {
  /** All events received so far (excluding heartbeats). */
  readonly events: ReceivedSseEvent[];
  /** All heartbeats received so far. */
  readonly heartbeats: ReceivedSseEvent[];
  /**
   * Wait until the buffer matches `predicate` (or `timeoutMs` elapses).
   * Returns the matching event; throws on timeout.
   */
  waitFor(
    predicate: (e: ReceivedSseEvent) => boolean,
    timeoutMs: number,
  ): Promise<ReceivedSseEvent>;
  /**
   * Sleep for `timeoutMs` then return everything captured. Useful for
   * negative assertions like "no events for the other brand".
   */
  collect(
    timeoutMs: number,
  ): Promise<{ events: ReceivedSseEvent[]; heartbeats: ReceivedSseEvent[] }>;
  /** Close the underlying connection. Idempotent. */
  stop(): Promise<void>;
  /** Resolved status code returned by the SSE handshake. */
  readonly status: Promise<number>;
}

export interface ReceivedSseEvent {
  /** Event name, e.g. `listing`, `shop-binding`, `heartbeat`. */
  type: string;
  /** Parsed JSON payload of the `data:` field. */
  data: unknown;
  /** Wall-clock timestamp (ms) when the event was assembled client-side. */
  receivedAt: number;
}

/**
 * Hand-rolled SSE client. We intentionally use `fetch` instead of the
 * browser-only `EventSource` so the helper works in the Node test runner
 * and lets us pass an arbitrary cookie / abort signal.
 */
export function subscribeSse(url: string, options: SseSubscribeOptions): SseSubscription {
  const controller = new AbortController();
  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  const finalUrl = options.brand
    ? `${url}${url.includes('?') ? '&' : '?'}brand=${encodeURIComponent(options.brand)}`
    : url;

  const events: ReceivedSseEvent[] = [];
  const heartbeats: ReceivedSseEvent[] = [];
  const waiters: Array<{
    predicate: (e: ReceivedSseEvent) => boolean;
    resolve: (e: ReceivedSseEvent) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  let stopped = false;
  let resolveStatus!: (n: number) => void;
  const statusPromise = new Promise<number>((resolve) => {
    resolveStatus = resolve;
  });

  const stop = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    stopped = true;
    controller.abort();
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.reject(new Error('SSE subscription stopped'));
    }
    waiters.length = 0;
  };

  const dispatch = (event: ReceivedSseEvent): void => {
    if (event.type === 'heartbeat') {
      heartbeats.push(event);
    } else {
      events.push(event);
    }
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i]!;
      if (w.predicate(event)) {
        clearTimeout(w.timer);
        w.resolve(event);
        waiters.splice(i, 1);
      }
    }
  };

  // Fire-and-forget read loop. We do NOT await — the helper returns the
  // subscription handle synchronously; consumers drive timing via stop()
  // and waitFor / collect.
  void (async () => {
    let response: Response | null = null;
    try {
      response = await fetch(finalUrl, {
        headers: {
          accept: 'text/event-stream',
          cookie: options.cookie,
        },
        signal: controller.signal,
      });
      resolveStatus(response.status);
      if (!response.ok || !response.body) {
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        // SSE messages are separated by a blank line. Process each one
        // as it lands so waitFor() unblocks promptly.
        let sep = buffer.indexOf('\n\n');
        while (sep >= 0) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const parsed = parseSseChunk(raw);
          if (parsed) {
            dispatch(parsed);
          }
          sep = buffer.indexOf('\n\n');
        }
      }
    } catch (err) {
      // Aborts are expected during stop(); rethrow only unexpected errors.
      if (!stopped) {
        // Surface to the next waiter instead of an unhandled rejection.
        for (const w of waiters.splice(0)) {
          clearTimeout(w.timer);
          w.reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
      // If the handshake errored before resolveStatus fired, surface a
      // sentinel so callers awaiting `status` don't hang forever.
      resolveStatus(response?.status ?? 0);
    }
  })();

  return {
    events,
    heartbeats,
    status: statusPromise,
    waitFor(predicate, timeoutMs) {
      const existing = events.find(predicate) ?? heartbeats.find(predicate);
      if (existing) {
        return Promise.resolve(existing);
      }
      return new Promise<ReceivedSseEvent>((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = waiters.findIndex((w) => w.timer === timer);
          if (idx >= 0) {
            waiters.splice(idx, 1);
          }
          reject(new Error(`SSE waitFor timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        waiters.push({ predicate, resolve, reject, timer });
      });
    },
    async collect(timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, timeoutMs));
      return { events: [...events], heartbeats: [...heartbeats] };
    },
    stop,
  };
}

function parseSseChunk(raw: string): ReceivedSseEvent | null {
  const lines = raw.split(/\r?\n/);
  let event = 'message';
  const dataParts: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    const colon = line.indexOf(':');
    if (colon < 0) {
      continue;
    }
    const field = line.slice(0, colon);
    let value = line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'event') {
      event = value;
    } else if (field === 'data') {
      dataParts.push(value);
    }
  }
  if (dataParts.length === 0) {
    return null;
  }
  const dataStr = dataParts.join('\n');
  let data: unknown;
  try {
    data = JSON.parse(dataStr);
  } catch {
    data = dataStr;
  }
  return { type: event, data, receivedAt: Date.now() };
}

/** Toggle `feature_flag.AGENT_NATIVE_REALTIME_UI` (global + per-brand). */
export async function setRealtimeFlag(
  request: APIRequestContext,
  accessToken: string,
  brandId: string,
  enabled: boolean,
): Promise<void> {
  const value = enabled ? 'true' : 'false';
  const keys = [
    'feature_flag.AGENT_NATIVE_REALTIME_UI',
    `feature_flag.AGENT_NATIVE_REALTIME_UI.${brandId}`,
  ];
  for (const key of keys) {
    const res = await request.put(`${API}/settings/feature-flags/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-yaemart-brand': brandId },
      data: { value },
    });
    if (res.status() !== 200) {
      throw new Error(`Failed to ${enabled ? 'enable' : 'disable'} ${key}: ${res.status()}`);
    }
  }
}

export const enableRealtimeFlag = (
  request: APIRequestContext,
  accessToken: string,
  brandId: string,
): Promise<void> => setRealtimeFlag(request, accessToken, brandId, true);

export const disableRealtimeFlag = (
  request: APIRequestContext,
  accessToken: string,
  brandId: string,
): Promise<void> => setRealtimeFlag(request, accessToken, brandId, false);

export const SSE_INBOX_URL = `${API}/realtime/inbox`;

/**
 * Plant the cookies a Playwright browser needs to render an admin page
 * with realtime turned on.
 *
 * Two domains are involved:
 *
 *   - Web BFF on `127.0.0.1:3000` reads `ym_access_token` /
 *     `ym_refresh_token` (see `apps/web/lib/auth/session.ts`) inside
 *     server components to gate `/[locale]/(admin)/...` routes. Without
 *     them the SSR layer redirects to `/login` and the page never
 *     mounts the `RealtimeProvider`.
 *   - NestJS API on `127.0.0.1:4000` reads `ya_sid` (HttpOnly cookie set
 *     by `/auth/login`) to authenticate `/realtime/inbox`. Without it
 *     the SSE handshake 401s and the bus stays in `error` state.
 *
 * `loginAsHomtoneAdmin` already returns the access/refresh tokens *and*
 * the parsed `ya_sid` cookie, so we can plant both in one call.
 */
export async function applySessionToContext(
  context: BrowserContext,
  session: AdminSession,
): Promise<void> {
  const yaSidValue = parseSessionCookieValue(session.cookieHeader);
  if (!yaSidValue) {
    throw new Error('applySessionToContext: cookieHeader missing ya_sid pair');
  }
  await context.addCookies([
    {
      name: 'ym_access_token',
      value: session.accessToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'ym_refresh_token',
      value: session.refreshToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: COOKIE_NAME,
      value: yaSidValue,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

/** Extract the raw value from a single `name=value` cookie pair. */
function parseSessionCookieValue(cookieHeader: string): string | null {
  const eq = cookieHeader.indexOf('=');
  if (eq < 0) {
    return null;
  }
  return cookieHeader.slice(eq + 1).trim();
}
