import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type {
  AdDashboardResponse,
  AdDailyBucket,
  AdMetricsSummary,
  AdType,
} from '@yaemartos/shared-types';
import { AdType as PrismaAdType } from '../generated/prisma';
import { PrismaClientManager } from '../database/prisma.service';
import type { AdDashboardQueryDto } from './dto/ad-dashboard-query.dto';

export type AdDashboardQuery = AdDashboardQueryDto & { brandId: string };

@Injectable()
export class AdDashboardService {
  constructor(private readonly prismaManager: PrismaClientManager) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async queryDashboard(dto: AdDashboardQuery): Promise<AdDashboardResponse> {
    // Defense-in-depth: brandId must always be present (injected by controller from auth context)
    if (!dto.brandId) {
      throw new InternalServerErrorException('brandId is required for ad dashboard query');
    }

    const startDate = new Date(dto.startDate + 'T00:00:00.000Z');
    // Include the full endDate day by querying up to the start of the next day
    const endDate = new Date(dto.endDate + 'T23:59:59.999Z');

    const shops = await this.prisma.shop.findMany({
      where: {
        brandId: dto.brandId,
        ...(dto.shopId ? { id: dto.shopId } : {}),
      },
      select: { id: true },
    });
    const resolvedShopIds = shops.map((s) => s.id);

    if (resolvedShopIds.length === 0) {
      return this.emptyResponse();
    }

    const where = {
      date: { gte: startDate, lte: endDate },
      shopId: { in: resolvedShopIds },
      ...(dto.adType ? { adType: dto.adType as PrismaAdType } : {}),
    };

    const rows = await this.prisma.adDailyStat.groupBy({
      by: ['date', 'adType'],
      where,
      _sum: {
        spend: true,
        sales: true,
        impressions: true,
        clicks: true,
        orders: true,
      },
      orderBy: { date: 'asc' },
    });

    const daily: AdDailyBucket[] = rows.map((row) => ({
      date: (row.date as Date).toISOString().split('T')[0]!,
      adType: row.adType as AdType,
      spend: row._sum.spend?.toNumber() ?? 0,
      sales: row._sum.sales?.toNumber() ?? 0,
      impressions: row._sum.impressions ?? 0,
      clicks: row._sum.clicks ?? 0,
      orders: row._sum.orders ?? 0,
    }));

    const totals: AdMetricsSummary = daily.reduce(
      (acc, b) => ({
        totalSpend: acc.totalSpend + b.spend,
        totalSales: acc.totalSales + b.sales,
        totalClicks: acc.totalClicks + b.clicks,
        totalImpressions: acc.totalImpressions + b.impressions,
        totalOrders: acc.totalOrders + b.orders,
      }),
      { totalSpend: 0, totalSales: 0, totalClicks: 0, totalImpressions: 0, totalOrders: 0 },
    );

    const acos = totals.totalSales > 0 ? (totals.totalSpend / totals.totalSales) * 100 : null;

    return { daily, totals, acos };
  }

  private emptyResponse(): AdDashboardResponse {
    return {
      daily: [],
      totals: {
        totalSpend: 0,
        totalSales: 0,
        totalClicks: 0,
        totalImpressions: 0,
        totalOrders: 0,
      },
      acos: null,
    };
  }
}
