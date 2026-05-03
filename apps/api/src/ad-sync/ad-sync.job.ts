export const AD_SYNC_QUEUE = 'ad-sync';
export const AD_DISPATCH_JOB = 'ad-sync:dispatch';
export const AD_SHOP_JOB = 'ad-sync:shop';

export interface AdShopSyncPayload {
  shopId: string;
  brandId: string;
  date: string; // ISO date string 'YYYY-MM-DD'
}
