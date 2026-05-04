import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Query,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Observable, interval, merge } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard, RequireFeatureFlag } from '../common/feature-flag/feature-flag.guard';
import { RealtimeBusService } from './realtime-bus.service';
import type { RealtimeEvent } from './realtime.types';

interface AuthenticatedRequest extends Request {
  user?: { id?: string; brandId?: string };
}

const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Realtime SSE inbox: long-lived per-tab connection that receives every
 * realtime event for the authenticated user's brand. The client uses a
 * single connection across the admin app and routes events to entity-level
 * subscribers via the `useEntityRevalidation` hook.
 *
 * Auth: HttpOnly `ya_sid` cookie set on `/auth/login`; the JWT strategy was
 * extended in W46 to extract from cookies as a fallback so EventSource
 * (which cannot send Authorization headers per W3C SSE) can authenticate.
 *
 * Tenant scoping: brand is derived from `req.user.brandId` (the JWT claim),
 * not from the `x-yaemart-brand` header (EventSource cannot set headers).
 * If the client passes `?brand=`, it must match the JWT brand. Cross-brand
 * subscription is rejected with 403.
 *
 * Feature flag: `feature_flag.AGENT_NATIVE_REALTIME_UI` — off by default in
 * all environments, flipped per brand via SystemConfig (see ADR-011 §D4).
 *
 * See [ADR-011](../../../../docs/adr/ADR-011-realtime-sync-strategy.md).
 */
@Controller('realtime')
@UseGuards(JwtAuthGuard, FeatureFlagGuard)
@RequireFeatureFlag('AGENT_NATIVE_REALTIME_UI')
export class RealtimeSseController {
  constructor(private readonly bus: RealtimeBusService) {}

  /**
   * Subscribe to brand-scoped realtime events.
   *
   * Throttled at 30 connections/min/IP to bound resource exhaustion if a
   * client reconnects in a tight loop. The `RealtimeBus` itself is fine
   * with high subscriber counts (RxJS multicast), but each open SSE
   * response holds an HTTP socket on the pod.
   */
  @Sse('inbox')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  inbox(
    @Req() req: AuthenticatedRequest,
    @Query('brand') brandOverride?: string,
  ): Observable<MessageEvent> {
    const userBrand = req.user?.brandId;
    if (!userBrand) {
      throw new ForbiddenException('JWT missing brandId claim');
    }
    if (brandOverride && brandOverride !== userBrand) {
      // Future: consult Casbin for multi-brand operators. For now we
      // refuse cross-brand subscription — explicit deny prevents mistakes.
      throw new ForbiddenException(
        `Cross-brand realtime subscription denied: token=${userBrand} requested=${brandOverride}`,
      );
    }

    const brandId = userBrand;
    const close$ = new Subject<void>();
    req.on('close', () => {
      close$.next();
      close$.complete();
    });

    const events$ = this.bus.subscribeForBrand(brandId).pipe(
      map((evt: RealtimeEvent) => {
        return new MessageEvent(evt.entity, {
          data: JSON.stringify(evt),
        });
      }),
    );

    // Heartbeat: comment-style keep-alive every 25s. Many ingress / proxy
    // layers (NGINX, ELB, K8s ingress-nginx) idle-close streams after 30–60s
    // unless data is flowing. Browsers ignore comment-only events but the
    // bytes flush downstream and reset the idle timer. ADR-011 §D2.
    const heartbeat$ = interval(HEARTBEAT_INTERVAL_MS).pipe(
      map(() => new MessageEvent('heartbeat', { data: JSON.stringify({ ts: Date.now() }) })),
    );

    return merge(events$, heartbeat$).pipe(takeUntil(close$));
  }

  /**
   * Diagnostic endpoint: echoes a single event back to the publisher's own
   * brand. Useful for QA and end-to-end verification of the SSE stack.
   * Production traffic should never call this, so it is disabled when
   * `NODE_ENV === 'production'`.
   */
  @Sse('debug-ping')
  ping(@Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('debug-ping disabled in production');
    }
    const brandId = req.user?.brandId ?? 'unknown';
    void this.bus.publish({
      entity: 'system-config',
      action: 'update',
      brandId,
      ids: ['debug-ping'],
      actorType: 'system',
      timestamp: Date.now(),
      metadata: { source: 'debug-ping' },
    });
    return this.bus.subscribeForBrand(brandId).pipe(
      map(
        (evt) =>
          new MessageEvent('debug', {
            data: JSON.stringify(evt),
          }),
      ),
    );
  }
}
