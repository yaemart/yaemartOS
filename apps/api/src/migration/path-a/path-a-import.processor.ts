import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LingxingClient } from '@yaemartos/lingxing-client';
import type { LingxingWalmartListingRaw } from '@yaemartos/lingxing-client';
import { RealtimeBusService } from '../../realtime/realtime-bus.service';
import { mapLingxingPathAExtraction, mapLingxingWalmartExtraction } from './mapping';
import { PathAImportService } from './path-a-import.service';
import { PATH_A_IMPORT_QUEUE } from './path-a-import.job';
import type { PathAImportJobPayload } from './path-a-import.job';
import type { PathAExtractionInput } from './types';

@Processor(PATH_A_IMPORT_QUEUE)
export class PathAImportProcessor extends WorkerHost {
  private readonly logger = new Logger(PathAImportProcessor.name);

  constructor(
    private readonly importService: PathAImportService,
    private readonly lingxingClient: LingxingClient,
    private readonly realtimeBus: RealtimeBusService,
  ) {
    super();
  }

  /**
   * Publish a `migration-job` realtime event after each progress update or
   * lifecycle transition. The frontend `import-job-progress` component uses
   * SSE as the primary signal and keeps an 8s polling fallback for the case
   * where Redis or SSE is unavailable.
   */
  private publishProgress(
    job: Job<PathAImportJobPayload>,
    status: 'active' | 'completed' | 'failed',
    progress: number,
    extra?: Record<string, string | number | boolean | null>,
  ): void {
    void this.realtimeBus.publish({
      entity: 'migration-job',
      action: 'update',
      brandId: job.data.brandId,
      ids: [String(job.id ?? job.data.runId), job.data.runId],
      actorType: 'system',
      timestamp: Date.now(),
      metadata: {
        runId: job.data.runId,
        platformCode: job.data.platformCode,
        status,
        progress,
        ...(extra ?? {}),
      },
    });
  }

  async process(job: Job<PathAImportJobPayload>): Promise<void> {
    const { runId, brandId, marketCode, platformCode, shopIds } = job.data;
    this.logger.log(
      `Processing Path A import job=${job.id} runId=${runId} brand=${brandId} platform=${platformCode}`,
    );

    this.publishProgress(job, 'active', 0);

    try {
      if (platformCode === 'amazon') {
        await this.processAmazonShops(job, runId, shopIds, { brandId, marketCode });
      } else {
        await this.processWalmartShops(job, runId, shopIds, { brandId, marketCode });
      }
      this.publishProgress(job, 'completed', 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.publishProgress(job, 'failed', 0, { error: message });
      throw err;
    }
  }

  private async processAmazonShops(
    job: Job<PathAImportJobPayload>,
    runId: string,
    shopIds: string[],
    ctx: { brandId: string; marketCode: string },
  ): Promise<void> {
    const allInputs: PathAExtractionInput[] = [];

    for (const shopId of shopIds) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const result = await this.lingxingClient.listings.getListingsForShop(shopId, {
          page,
          pageSize: 100,
        });

        const inputs: PathAExtractionInput[] = result.records.map((raw, idx) => ({
          runId,
          sourceRecordId: `${shopId}-p${page}-${idx}`,
          rawListing: {
            seller_sku: raw.seller_sku,
            asin: raw.asin,
            listing_title: raw.title,
            bullet_points: raw.bullet_points,
            description: raw.description,
            search_terms: raw.search_terms,
            marketplace_id: raw.marketplace_id,
            shop_id: raw.shop_id,
            updated_at: raw.last_updated_time,
          },
        }));

        allInputs.push(...inputs);
        hasMore = result.hasMore;
        page++;
        const progress = Math.round((allInputs.length / (result.total || 1)) * 50);
        await job.updateProgress(progress);
        this.publishProgress(job, 'active', progress, { phase: 'extract' });
      }
    }

    const summary = await this.importService.importFromExtractionInputs(allInputs, {
      ...ctx,
      platformCode: 'amazon',
    });
    await job.updateProgress(100);
    this.publishProgress(job, 'active', 100, {
      phase: 'import',
      imported: summary.imported,
      failed: summary.failed,
    });
    this.logger.log(
      `Path A Amazon import done job=${job.id} imported=${summary.imported} failed=${summary.failed}`,
    );
  }

  private async processWalmartShops(
    job: Job<PathAImportJobPayload>,
    runId: string,
    shopIds: string[],
    ctx: { brandId: string; marketCode: string },
  ): Promise<void> {
    const allRecords: ReturnType<typeof mapLingxingWalmartExtraction>[] = [];

    for (const shopId of shopIds) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const result = await this.lingxingClient.listings.getWalmartListingsForShop(shopId, {
          page,
          pageSize: 100,
        });

        const extractionResults = result.records.map(
          (raw: LingxingWalmartListingRaw, idx: number) =>
            mapLingxingWalmartExtraction(runId, `${shopId}-p${page}-${idx}`, raw),
        );

        allRecords.push(...extractionResults);
        hasMore = result.hasMore;
        page++;
        const progress = Math.round((allRecords.length / (result.total || 1)) * 50);
        await job.updateProgress(progress);
        this.publishProgress(job, 'active', progress, { phase: 'extract' });
      }
    }

    const summary = await this.importService.importMappedRecords(allRecords, {
      ...ctx,
      platformCode: 'walmart',
    });
    await job.updateProgress(100);
    this.publishProgress(job, 'active', 100, {
      phase: 'import',
      imported: summary.imported,
      failed: summary.failed,
    });
    this.logger.log(
      `Path A Walmart import done job=${job.id} imported=${summary.imported} failed=${summary.failed}`,
    );
  }
}
