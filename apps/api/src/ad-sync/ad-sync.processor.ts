import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { format, subDays } from 'date-fns';
import { PrismaClientManager } from '../database/prisma.service';
import { FeatureFlagService } from '../common/feature-flag/feature-flag.service';
import { AdSyncService } from './ad-sync.service';
import { AD_SYNC_QUEUE, AD_DISPATCH_JOB, AD_SHOP_JOB } from './ad-sync.job';
import type { AdShopSyncPayload } from './ad-sync.job';

@Processor(AD_SYNC_QUEUE)
export class AdSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(AdSyncProcessor.name);

  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly featureFlagService: FeatureFlagService,
    private readonly adSyncService: AdSyncService,
    @InjectQueue(AD_SYNC_QUEUE) private readonly adSyncQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<AdShopSyncPayload | Record<string, never>>): Promise<void> {
    if (job.name === AD_DISPATCH_JOB) {
      await this.handleDispatch();
    } else if (job.name === AD_SHOP_JOB) {
      const payload = job.data as AdShopSyncPayload;
      await this.handleShopSync(payload);
    } else {
      this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleDispatch(): Promise<void> {
    const flagEnabled = await this.featureFlagService.isEnabled('AD_SYNC');
    if (!flagEnabled) {
      this.logger.log('AD_SYNC feature flag is disabled, skipping dispatch');
      return;
    }

    const prisma = this.prismaManager.getPublicClient();
    const bindings = await prisma.shopBinding.findMany({
      where: { syncEnabled: true },
      include: { shop: true },
    });

    if (!bindings.length) {
      this.logger.log('No active shop bindings found, skipping dispatch');
      return;
    }

    const date = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    this.logger.log(`Dispatching ad-sync jobs for ${bindings.length} shops, date=${date}`);

    await Promise.all(
      bindings.map((binding) =>
        this.adSyncQueue.add(
          AD_SHOP_JOB,
          {
            shopId: binding.shopId,
            brandId: binding.shop.brandId,
            date,
          } satisfies AdShopSyncPayload,
          { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
        ),
      ),
    );

    this.logger.log(`Dispatched ${bindings.length} ad-sync:shop jobs for date=${date}`);
  }

  private async handleShopSync(payload: AdShopSyncPayload): Promise<void> {
    const { shopId, brandId, date } = payload;
    this.logger.log(`Processing ad-sync:shop shopId=${shopId} brandId=${brandId} date=${date}`);

    const result = await this.adSyncService.syncShopDate(shopId, brandId, date);
    this.logger.log(
      `Completed ad-sync:shop shopId=${shopId} date=${date} result=${JSON.stringify(result)}`,
    );
  }
}
