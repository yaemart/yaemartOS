export interface LingxingInventoryRaw {
  seller_sku: string;
  asin?: string;
  marketplace_id: string;
  fulfillable_quantity?: number;
  inbound_quantity?: number;
  reserved_quantity?: number;
  unfulfillable_quantity?: number;
  total_quantity?: number;
  days_of_supply?: number;
}

export interface MappedInventory {
  sku: string;
  asin?: string;
  marketplaceId: string;
  fbaAvailable: number;
  fbaInbound: number;
  fbaReserved: number;
  fbaUnfulfillable: number;
  fbaTotal: number;
  daysOfSupply: number;
  snapshotAt: Date;
}
