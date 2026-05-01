import { Inject, Injectable } from '@nestjs/common';
import { LingxingClient } from '../lingxing-client';
import { LINGXING_CLIENT_OPTIONS } from '../tokens';
import { LingxingClientOptions } from '../lingxing-client.options';
import { BusinessError } from '../errors/lingxing-error';
import type { MappedInventory } from '../types/inventory.types';
import type { MappedListing } from '../types/listing.types';

export interface QueryInventoryParams {
  shopId: string;
  marketplaceId: string;
}

export interface GetListingSummaryParams {
  asin: string;
  shopId?: string;
}

export interface GetKeywordSuggestionsParams {
  asin: string;
}

@Injectable()
export class LingxingMcpBridge {
  private readonly allowedShopIds: string[];

  constructor(
    private readonly client: LingxingClient,
    @Inject(LINGXING_CLIENT_OPTIONS) options: LingxingClientOptions,
  ) {
    this.allowedShopIds = options.allowedShopIds ?? [];
  }

  private validateShopId(shopId: string): void {
    if (this.allowedShopIds.length > 0 && !this.allowedShopIds.includes(shopId)) {
      throw new BusinessError(`shopId '${shopId}' not in allowed list`);
    }
  }

  async queryInventory(params: QueryInventoryParams): Promise<MappedInventory[]> {
    this.validateShopId(params.shopId);
    return this.client.inventory.getSnapshot(params.marketplaceId);
  }

  async getListingSummary(params: GetListingSummaryParams): Promise<MappedListing | null> {
    if (params.shopId) {
      this.validateShopId(params.shopId);
    }
    return this.client.listings.getByAsin(params.asin);
  }

  async getKeywordSuggestions(params: GetKeywordSuggestionsParams): Promise<string[]> {
    const listing = await this.client.listings.getByAsin(params.asin);
    if (!listing) {
      return [];
    }
    return listing.searchTerms ?? [];
  }
}
