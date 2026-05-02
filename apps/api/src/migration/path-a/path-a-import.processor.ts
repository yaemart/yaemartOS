import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LingxingClient } from '@yaemartos/lingxing-client';
import type { LingxingWalmartListingRaw } from '@yaemartos/lingxing-client';
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
  ) {
    super();
  }

  async process(job: Job<PathAImportJobPayload>): Promise<void> {
    const { runId, brandId, marketCode, platformCode, shopIds } = job.data;
    this.logger.log(
      `Processing Path A import job=${job.id} runId=${runId} brand=${brandId} platform=${platformCode}`,
    );

    if (platformCode === 'amazon') {
      await this.processAmazonShops(job, runId, shopIds, { brandId, marketCode });
    } else {
      await this.processWalmartShops(job, runId, shopIds, { brandId, marketCode });
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
        await job.updateProgress(Math.round((allInputs.length / (result.total || 1)) * 50));
      }
    }

    const summary = await this.importService.importFromExtractionInputs(allInputs, {
      ...ctx,
      platformCode: 'amazon',
    });
    await job.updateProgress(100);
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
        await job.updateProgress(Math.round((allRecords.length / (result.total || 1)) * 50));
      }
    }

    const summary = await this.importService.importMappedRecords(allRecords, {
      ...ctx,
      platformCode: 'walmart',
    });
    await job.updateProgress(100);
    this.logger.log(
      `Path A Walmart import done job=${job.id} imported=${summary.imported} failed=${summary.failed}`,
    );
  }
}
