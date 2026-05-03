import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { PrismaClientManager } from '../database/prisma.service';
import { PlatformCode } from '../generated/prisma';
import { PATH_A_IMPORT_QUEUE } from './path-a/path-a-import.job';
import type { PathAImportJobPayload, PathAImportJobProgress } from './path-a/path-a-import.job';
import type { PathAPlatformCode } from './path-a/types';

class TriggerPathAImportDto {
  brandId!: string;
  marketCode!: string;
  platformCode!: PathAPlatformCode;
  shopIds!: string[];
}

export interface AvailableShop {
  lingxingShopId: string;
  shopName: string;
  platformName: string;
  marketName: string;
}

@Controller('migration')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class MigrationController {
  constructor(
    @InjectQueue(PATH_A_IMPORT_QUEUE)
    private readonly queue: Queue<PathAImportJobPayload>,
    private readonly prismaManager: PrismaClientManager,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  /**
   * List bound Lingxing shops for a brand+platform combination.
   * Only shops with a non-null lingxingShopId are returned.
   * The frontend uses this to populate the shop picker on the migration form.
   *
   * brandId is read from the x-yaemart-brand request header (same as ShopController)
   * to prevent cross-brand data access via query-param tampering.
   */
  @Get('path-a/shops')
  @RequirePolicy({ obj: 'migration', act: 'read' })
  async getAvailableShops(
    @Headers('x-yaemart-brand') brandId: string,
    @Query('platformCode') platformCode: string,
  ): Promise<AvailableShop[]> {
    if (!brandId) {
      throw new BadRequestException('x-yaemart-brand header is required');
    }
    const validPlatformCodes = Object.values(PlatformCode) as string[];
    if (!platformCode || !validPlatformCodes.includes(platformCode)) {
      throw new BadRequestException(
        `platformCode must be one of: ${validPlatformCodes.join(', ')}`,
      );
    }

    const shops = await this.prisma.shop.findMany({
      where: {
        brandId,
        platform: { code: platformCode as PlatformCode },
        binding: { lingxingShopId: { not: null } },
      },
      include: {
        binding: { select: { lingxingShopId: true } },
        platform: { select: { name: true } },
        market: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return shops
      .filter((s) => s.binding?.lingxingShopId)
      .map((s) => ({
        lingxingShopId: s.binding!.lingxingShopId!,
        shopName: s.name,
        platformName: s.platform?.name ?? platformCode,
        marketName: s.market?.name ?? '',
      }));
  }

  @Post('path-a/jobs')
  @RequirePolicy({ obj: 'migration', act: 'write' })
  async triggerPathAImport(@Body() dto: TriggerPathAImportDto) {
    const runId = `patha-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const payload: PathAImportJobPayload = {
      runId,
      brandId: dto.brandId,
      marketCode: dto.marketCode,
      platformCode: dto.platformCode,
      shopIds: dto.shopIds,
    };

    const job = await this.queue.add('import', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400 },
      removeOnFail: { age: 604800 },
    });

    return {
      jobId: job.id,
      runId,
      status: 'waiting',
      message: `Path A import job queued for brand=${dto.brandId} platform=${dto.platformCode}`,
    };
  }

  @Get('path-a/jobs/:jobId')
  @RequirePolicy({ obj: 'migration', act: 'read' })
  async getJobStatus(@Param('jobId') jobId: string): Promise<PathAImportJobProgress> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    const progress = typeof job.progress === 'number' ? job.progress : 0;

    const result = job.returnvalue as
      | {
          imported?: number;
          failed?: number;
          failures?: Array<{ sku: string; reason: string }>;
        }
      | undefined;

    return {
      jobId,
      runId: job.data.runId,
      status: state as PathAImportJobProgress['status'],
      progress,
      imported: result?.imported,
      failed: result?.failed,
      failures: result?.failures,
      error: job.failedReason,
      createdAt: new Date(job.timestamp).toISOString(),
      updatedAt: new Date(job.processedOn ?? job.timestamp).toISOString(),
    };
  }

  @Get('path-a/jobs')
  @RequirePolicy({ obj: 'migration', act: 'read' })
  async listRecentJobs() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaiting(0, 9),
      this.queue.getActive(0, 9),
      this.queue.getCompleted(0, 9),
      this.queue.getFailed(0, 9),
    ]);

    const toSummary = async (jobs: Awaited<ReturnType<typeof this.queue.getWaiting>>) =>
      Promise.all(
        jobs.map(async (j) => ({
          jobId: j.id,
          runId: j.data.runId,
          brandId: j.data.brandId,
          platformCode: j.data.platformCode,
          status: await j.getState(),
          progress: typeof j.progress === 'number' ? j.progress : 0,
          createdAt: new Date(j.timestamp).toISOString(),
        })),
      );

    return {
      waiting: await toSummary(waiting),
      active: await toSummary(active),
      completed: await toSummary(completed),
      failed: await toSummary(failed),
    };
  }
}
