import { Injectable } from '@nestjs/common';
import type {
  AdDashboardResponse,
  AdDailyBucket,
  AdMetricsSummary,
  AdType,
} from '@yaemartos/shared-types';
import { PrismaClientManager } from '../database/prisma.service';
import type { AdDashboardQueryDto } from './dto/ad-dashboard-query.dto';

@Injectable()
export class AdDashboardService {
  constructor(private readonly prismaManager: PrismaClientManager) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async queryDashboard(dto: AdDashboardQueryDto): Promise<AdDashboardResponse> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    // Build shopId list when brandId is provided
    let resolvedShopIds: string[] | undefined;

    if (dto.brandId) {
      const shops = await this.prisma.shop.findMany({
        where: {
          brandId: dto.brandId,
          ...(dto.shopId ? { id: dto.shopId } : {}),
        },
        select: { id: true },
      });
      resolvedShopIds = shops.map((s) => s.id);

      if (resolvedShopIds.length === 0) {
        return this.emptyResponse();
      }
    }

    const where = {
      date: { gte: startDate, lte: endDate },
      ...(resolvedShopIds
        ? { shopId: { in: resolvedShopIds } }
        : dto.shopId
          ? { shopId: dto.shopId }
          : {}),
      ...(dto.adType ? { adType: dto.adType as any } : {}),
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
