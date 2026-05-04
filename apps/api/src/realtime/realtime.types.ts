/**
 * Domain entity names that producers may publish on. Keep this list narrow
 * and explicit: the SSE channel is per-brand cross-entity, so adding new
 * entities should be a deliberate decision matched by the matching frontend
 * `useEntityRevalidation()` consumer.
 *
 * See ADR-011 §D2 for the design.
 */
export const REALTIME_ENTITIES = [
  'listing',
  'listing-version',
  'ad-suggestion',
  'ad-change',
  'ad-daily-stat',
  'shop-binding',
  'system-config',
  'migration-job',
  'terminology',
] as const;

export type RealtimeEntity = (typeof REALTIME_ENTITIES)[number];

export type RealtimeAction = 'create' | 'update' | 'delete';

export type RealtimeActorType = 'user' | 'agent' | 'system';

/**
 * Wire format for the realtime bus.
 *
 * `brandId` is mandatory and used by the SSE controller to filter events to
 * the subscriber's tenant; `ids` carries the affected primary keys so a
 * client may further narrow which queries to invalidate.
 */
export interface RealtimeEvent {
  entity: RealtimeEntity;
  action: RealtimeAction;
  brandId: string;
  ids: string[];
  actorType: RealtimeActorType;
  actorId?: string;
  timestamp: number;
  /** Optional small extra (NOT for full row payloads — keep < 1KB). */
  metadata?: Record<string, string | number | boolean | null>;
}

export const REALTIME_PUBSUB_CHANNEL = 'yaemartos:realtime:agent_write';
