'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useRealtimeContext } from './realtime-provider';
import type { RealtimeEntity, RealtimeEvent, RevalidationMode } from './realtime-types';

interface UseEntityRevalidationOptions {
  /**
   * `'auto'` invalidates affected queries and triggers `router.refresh()`
   * the moment an event arrives. Use on list/dashboard pages where the
   * user is not actively editing.
   *
   * `'toast'` accumulates events into `pendingEvents` so the page can
   * show a non-destructive notification (e.g. "Agent X modified this
   * listing — Apply?"). Use on editor pages where auto-refresh would
   * destroy unsaved edits.
   *
   * See ADR-011 §D3.
   */
  mode: RevalidationMode;
  /**
   * Limit which event ids trigger this hook. Useful on detail pages
   * where only one entity row matters; omit on list pages to receive
   * every event for the entity.
   */
  filterIds?: string[];
  /**
   * `@tanstack/react-query` query keys to invalidate. Defaults to a
   * single-segment key matching the entity name; pass explicit keys to
   * narrow or broaden invalidation.
   */
  queryKeys?: readonly (readonly unknown[])[];
  /**
   * Called for each matching event. In `'auto'` mode, this fires before
   * the auto-invalidation; in `'toast'` mode, the page is responsible for
   * calling `acceptPending()` after surfacing the toast.
   */
  onEvent?: (event: RealtimeEvent) => void;
}

interface UseEntityRevalidationResult {
  /** Latest event for `'toast'` mode consumers. */
  latestEvent: RealtimeEvent | null;
  /**
   * Pending events waiting for the user to accept (e.g. via toast click).
   * In `'auto'` mode this is always empty.
   */
  pendingEvents: RealtimeEvent[];
  /**
   * Apply queued invalidations now. Call from a toast click in `'toast'`
   * mode after the user confirms losing local edits.
   */
  acceptPending: () => void;
  /** Discard buffered events without invalidating. */
  dismissPending: () => void;
}

/**
 * Subscribe a page or component to realtime events for an entity.
 *
 * Always mounted alongside `RealtimeProvider` higher in the tree. Safe to
 * call when the provider's bus is `null` (feature flag off): the hook
 * becomes a no-op and `latestEvent` stays null.
 *
 * Quick examples:
 *
 * ```ts
 * // List page: apply every event immediately
 * useEntityRevalidation('ad-suggestion', { mode: 'auto' });
 *
 * // Editor page: collect events, surface toast, defer to user click
 * const { latestEvent, acceptPending } = useEntityRevalidation('listing', {
 *   mode: 'toast',
 *   filterIds: [listingId],
 * });
 * ```
 */
export function useEntityRevalidation(
  entity: RealtimeEntity,
  options: UseEntityRevalidationOptions,
): UseEntityRevalidationResult {
  const { mode, filterIds, queryKeys, onEvent } = options;
  const { bus } = useRealtimeContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [latestEvent, setLatestEvent] = useState<RealtimeEvent | null>(null);
  const [pendingEvents, setPendingEvents] = useState<RealtimeEvent[]>([]);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!bus) {
      return;
    }
    const detach = bus.on(entity, (event) => {
      if (filterIds && filterIds.length > 0) {
        const overlap = event.ids.some((id) => filterIds.includes(id));
        if (!overlap) {
          return;
        }
      }
      setLatestEvent(event);
      onEventRef.current?.(event);
      if (mode === 'auto') {
        applyInvalidations(queryClient, entity, queryKeys);
        router.refresh();
      } else {
        setPendingEvents((prev) => [...prev, event]);
      }
    });
    return () => detach();
  }, [bus, entity, mode, filterIds, queryKeys, queryClient, router]);

  return {
    latestEvent,
    pendingEvents,
    acceptPending: () => {
      applyInvalidations(queryClient, entity, queryKeys);
      router.refresh();
      setPendingEvents([]);
    },
    dismissPending: () => setPendingEvents([]),
  };
}

function applyInvalidations(
  queryClient: ReturnType<typeof useQueryClient>,
  entity: RealtimeEntity,
  queryKeys: readonly (readonly unknown[])[] | undefined,
): void {
  const keys: readonly (readonly unknown[])[] = queryKeys ?? [[entity]];
  for (const key of keys) {
    void queryClient.invalidateQueries({ queryKey: key as readonly unknown[] });
  }
}
