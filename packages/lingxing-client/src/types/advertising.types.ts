export interface LingxingAdReportRaw {
  campaign_id?: string;
  campaign_name?: string;
  ad_group_id?: string;
  impressions?: number;
  clicks?: number;
  spend?: string | number;
  sales?: string | number;
  orders?: number;
  [key: string]: unknown;
}

export interface MappedAdReport {
  campaignId: string;
  campaignName?: string;
  impressions: number;
  clicks: number;
  spend: number;
  sales: number;
  orders: number;
}

export interface AdReportFetchResult {
  records: MappedAdReport[];
  shopId: string;
  date: string;
  adType: 'sp' | 'sd' | 'sb' | 'walmart_sp';
}
