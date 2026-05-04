import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LingxingClientModule } from '@yaemartos/lingxing-client';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';
import { AdSyncService } from './ad-sync.service';
import { AdSyncProcessor } from './ad-sync.processor';
import { AD_SYNC_QUEUE, AD_DISPATCH_JOB } from './ad-sync.job';

@Module({
  imports: [
    BullModule.registerQueue({ name: AD_SYNC_QUEUE }),
    LingxingClientModule,
    FeatureFlagModule,
  ],
  providers: [AdSyncService, AdSyncProcessor],
  exports: [AdSyncService],
})
export class AdSyncModule implements OnModuleInit {
  private readonly logger = new Logger(AdSyncModule.name);

  constructor(@InjectQueue(AD_SYNC_QUEUE) private readonly dispatchQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    const CRON_PATTERN = '0 1 * * *';

    // Clean up stale repeat schedules (e.g. pattern changed, leftover from rolling deployments)
    // before re-registering, so multi-instance K8s restarts don't accumulate duplicates.
    const existing = await this.dispatchQueue.getRepeatableJobs();
    const stale = existing.filter((j) => j.name === AD_DISPATCH_JOB && j.pattern !== CRON_PATTERN);
    await Promise.all(stale.map((j) => this.dispatchQueue.removeRepeatableByKey(j.key)));

    await this.dispatchQueue.add(
      AD_DISPATCH_JOB,
      {},
      { repeat: { pattern: CRON_PATTERN }, jobId: 'daily-ad-dispatch' },
    );
    this.logger.log('Registered daily ad-sync dispatch cron (01:00 UTC)');
  }
}
