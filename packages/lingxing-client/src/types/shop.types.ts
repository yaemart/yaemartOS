/** Raw shop record from GET /erp/sc/data/seller/lists */
export interface LingxingShopRaw {
  sid: number;
  mid: number;
  name: string;
  seller_id: string;
  account_name: string;
  seller_account_id: number;
  region: string;
  country: string;
  marketplace_id: string;
  /** 1 = normal, 2 = auth exception, 3 = payment overdue, 0 = sync stopped */
  status: number;
  has_ads_setting: number;
}

export interface MappedShop {
  /** Lingxing internal shop ID (sid) */
  shopId: string;
  shopName: string;
  marketplaceId: string;
  region: string;
  country: string;
  sellerId: string;
  accountName: string;
  isActive: boolean;
  /** 1 = normal, 2 = auth exception, 3 = overdue, 0 = stopped */
  status: number;
}
