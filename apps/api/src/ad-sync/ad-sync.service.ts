import { Injectable, Logger } from '@nestjs/common';
import { AdType } from '../generated/prisma';
import { PrismaClientManager } from '../database/prisma.service';
import { LingxingClient } from '@yaemartos/lingxing-client';
import type { AdReportFetchResult, MappedAdReport } from '@yaemartos/lingxing-client';

export type AdTypeStatus = 'ok' | 'skipped' | 'error';

export interface SyncShopResult {
  sp: AdTypeStatus;
  sd: AdTypeStatus;
  sb: AdTypeStatus;
  walmart_sp: AdTypeStatus;
}

interface UpsertAdStatInput {
  shopId: string;
  date: Date;
  adType: AdType;
  record: MappedAdReport;
}

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

    const isWalmart = shop.platform.code === 'walmart';
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

    await prisma.metric.create({
      data: {
        name: `ad.spend.${shopId}.${date}`,
        value: totalSpend,
        unit: 'USD',
        brandId,
      },
    });

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
      const dateObj = new Date(date);
      let totalSpend = 0;

      const inputs: UpsertAdStatInput[] = fetchResult.records.map((record) => ({
        shopId,
        date: dateObj,
        adType,
        record,
      }));

      for (const input of inputs) {
        await prisma.adDailyStat.upsert({
          where: {
            shopId_date_adType_campaignId: {
              shopId: input.shopId,
              date: input.date,
              adType: input.adType,
              campaignId: input.record.campaignId,
            },
          },
          create: {
            shopId: input.shopId,
            date: input.date,
            adType: input.adType,
            campaignId: input.record.campaignId,
            campaignName: input.record.campaignName,
            spend: input.record.spend,
            sales: input.record.sales,
            impressions: input.record.impressions,
            clicks: input.record.clicks,
            orders: input.record.orders,
            syncedAt: new Date(),
          },
          update: {
            campaignName: input.record.campaignName,
            spend: input.record.spend,
            sales: input.record.sales,
            impressions: input.record.impressions,
            clicks: input.record.clicks,
            orders: input.record.orders,
            syncedAt: new Date(),
          },
        });
        totalSpend += input.record.spend;
      }

      return { status: 'ok', spend: totalSpend };
    } catch (err) {
      this.logger.warn(
        `fetchAndUpsert failed shopId=${shopId} date=${date} adType=${adType}: ${String(err)}`,
      );
      return { status: 'error', spend: 0 };
    }
  }
}
