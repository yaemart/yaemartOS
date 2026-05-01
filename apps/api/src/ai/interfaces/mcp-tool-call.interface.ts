import type { MappedInventory } from '@yaemartos/lingxing-client';
import type { MappedListing } from '@yaemartos/lingxing-client';

export interface IMcpToolCallService {
  ping(): Promise<'ok'>;
  queryInventory(params: { shopId: string; marketplaceId: string }): Promise<MappedInventory[]>;
  getListingSummary(params: { asin: string; shopId?: string }): Promise<MappedListing | null>;
  getKeywordSuggestions(params: { asin: string }): Promise<string[]>;
}
