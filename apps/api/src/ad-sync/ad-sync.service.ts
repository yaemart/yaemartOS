import { Injectable, Logger } from '@nestjs/common';
import { AdType } from '../generated/prisma';
import { PrismaClientManager } from '../database/prisma.service';
import { LingxingClient } from '@yaemartos/lingxing-client';
import type { AdReportFetchResult } from '@yaemartos/lingxing-client';

export type AdTypeStatus = 'ok' | 'skipped' | 'error';

export interface SyncShopResult {
  sp: AdTypeStatus;
  sd: AdTypeStatus;
  sb: AdTypeStatus;
  walmart_sp: AdTypeStatus;
}

const WALMART_PLATFORM_CODE = 'walmart';

@Injectable()
export class AdSyncService {
  private readonly logger = new Logger(AdSyncService.name);

  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly lingxingClient: LingxingClient,
  ) {}

  async syncShopDate(shopId: string, brandId: string, date: string): Promise<SyncShopResult> {
    const prisma = this.prismaManager.getPublicClient();

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      include: { platform: true },
    });

    if (!shop) {
      this.logger.warn(`syncShopDate: shop ${shopId} not found`);
      return { sp: 'error', sd: 'error', sb: 'error', walmart_sp: 'error' };
    }

    const isWalmart = shop.platform.code === WALMART_PLATFORM_CODE;
    const result: SyncShopResult = {
      sp: 'skipped',
      sd: 'skipped',
      sb: 'skipped',
      walmart_sp: 'skipped',
    };
    let totalSpend = 0;

    if (isWalmart) {
      const walmartStatus = await this.fetchAndUpsert(shopId, date, 'walmart_sp', () =>
        this.lingxingClient.advertising.getWalmartCampaignReport(shopId, date),
      );
      result.walmart_sp = walmartStatus.status;
      totalSpend += walmartStatus.spend;
    } else {
      const [spStatus, sdStatus, sbStatus] = await Promise.all([
        this.fetchAndUpsert(shopId, date, 'sp', () =>
          this.lingxingClient.advertising.getSpCampaignReport(shopId, date),
        ),
        this.fetchAndUpsert(shopId, date, 'sd', () =>
          this.lingxingClient.advertising.getSdCampaignReport(shopId, date),
        ),
        this.fetchAndUpsert(shopId, date, 'sb', () =>
          this.lingxingClient.advertising.getSbCampaignReport(shopId, date),
        ),
      ]);
      result.sp = spStatus.status;
      result.sd = sdStatus.status;
      result.sb = sbStatus.status;
      totalSpend += spStatus.spend + sdStatus.spend + sbStatus.spend;
    }

    // Idempotent metric write: delete any prior record for this shopId+date before creating fresh one.
    // Metric table is a time-series store (no unique constraint on name) so we manage idempotency
    // explicitly to avoid duplicate rows on BullMQ retry (attempts: 3).
    const metricName = `ad.spend.${shopId}.${date}`;
    await prisma.$transaction([
      prisma.metric.deleteMany({ where: { name: metricName } }),
      prisma.metric.create({ data: { name: metricName, value: totalSpend, unit: 'USD', brandId } }),
    ]);

    this.logger.log(
      `syncShopDate shopId=${shopId} date=${date} totalSpend=${totalSpend} result=${JSON.stringify(result)}`,
    );

    return result;
  }

  private async fetchAndUpsert(
    shopId: string,
    date: string,
    adType: AdType,
    fetchFn: () => Promise<AdReportFetchResult>,
  ): Promise<{ status: AdTypeStatus; spend: number }> {
    try {
      const fetchResult = await fetchFn();

      if (!fetchResult.records.length) {
        return { status: 'ok', spend: 0 };
      }

      const prisma = this.prismaManager.getPublicClient();
      // Use UTC midnight to avoid local timezone shifts (e.g. UTC+9 turning '2026-05-03' into May 2)
      const dateObj = new Date(date + 'T00:00:00.000Z');
      const totalSpend = fetchResult.records.reduce((sum, r) => sum + r.spend, 0);

      // Batch all upserts in a single transaction instead of N sequential awaits.
      // For ~100 campaigns this is ~5-10x faster than sequential await inside a loop.
      await prisma.$transaction(
        fetchResult.records.map((record) =>
          prisma.adDailyStat.upsert({
            where: {
              shopId_date_adType_campaignId: {
                shopId,
                date: dateObj,
                adType,
                campaignId: record.campaignId,
              },
            },
            create: {
              shopId,
              date: dateObj,
              adType,
              campaignId: record.campaignId,
              campaignName: record.campaignName,
              spend: record.spend,
              sales: record.sales,
              impressions: record.impressions,
              clicks: record.clicks,
              orders: record.orders,
              syncedAt: new Date(),
            },
            update: {
              campaignName: record.campaignName,
              spend: record.spend,
              sales: record.sales,
              impressions: record.impressions,
              clicks: record.clicks,
              orders: record.orders,
              syncedAt: new Date(),
            },
          }),
        ),
      );

      return { status: 'ok', spend: totalSpend };
    } catch (err) {
      this.logger.warn(
        `fetchAndUpsert failed shopId=${shopId} date=${date} adType=${adType}: ${String(err)}`,
      );
      return { status: 'error', spend: 0 };
    }
  }
}
