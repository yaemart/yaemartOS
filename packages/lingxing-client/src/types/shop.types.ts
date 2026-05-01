export interface LingxingShopRaw {
  shop_id: string;
  shop_name: string;
  marketplace_id: string;
  status: number;
}

export interface MappedShop {
  shopId: string;
  shopName: string;
  marketplaceId: string;
  isActive: boolean;
}
