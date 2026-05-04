/**
 * Wire shape mirrors `apps/api/src/realtime/realtime.types.ts`. Kept as a
 * standalone copy to avoid pulling backend imports into the browser bundle.
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

export interface RealtimeEvent {
  entity: RealtimeEntity;
  action: RealtimeAction;
  brandId: string;
  ids: string[];
  actorType: RealtimeActorType;
  actorId?: string;
  timestamp: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export type RevalidationMode = 'auto' | 'toast';
