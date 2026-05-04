import { describe, expect, it, vi } from 'vitest';
import { PathAImportProcessor } from './path-a-import.processor';

function createProcessor() {
  const importService = {
    importFromExtractionInputs: vi.fn().mockResolvedValue({
      runId: 'patha-run-1',
      total: 1,
      deduplicated: 1,
      imported: 1,
      failed: 0,
      failures: [],
    }),
    importMappedRecords: vi.fn().mockResolvedValue({
      runId: 'patha-run-1',
      total: 1,
      deduplicated: 1,
      imported: 1,
      failed: 0,
      failures: [],
    }),
  } as any;
  const lingxingClient = {
    listings: {
      getListingsForShop: vi.fn().mockResolvedValue({
        records: [],
        total: 0,
        hasMore: false,
      }),
      getWalmartListingsForShop: vi.fn().mockResolvedValue({
        records: [],
        total: 0,
        hasMore: false,
      }),
    },
  } as any;
  const realtimeBus = {
    publish: vi.fn().mockResolvedValue(undefined),
  } as any;

  const processor = new PathAImportProcessor(importService, lingxingClient, realtimeBus);
  return { processor, importService, lingxingClient, realtimeBus };
}

function makeJob(payload: Record<string, unknown>) {
  return {
    id: 'job_1',
    data: payload,
    updateProgress: vi.fn().mockResolvedValue(undefined),
  } as any;
}

describe('PathAImportProcessor realtime publish (P0-D)', () => {
  it('publishes start (active 0%) and completion (completed 100%) for amazon imports', async () => {
    const { processor, realtimeBus } = createProcessor();
    const job = makeJob({
      runId: 'patha-run-1',
      brandId: 'homtone',
      marketCode: 'US',
      platformCode: 'amazon',
      shopIds: ['shop_1'],
    });

    await processor.process(job);

    const calls = realtimeBus.publish.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls[0]).toEqual(
      expect.objectContaining({
        entity: 'migration-job',
        action: 'update',
        brandId: 'homtone',
        actorType: 'system',
        ids: ['job_1', 'patha-run-1'],
        metadata: expect.objectContaining({ status: 'active', progress: 0 }),
      }),
    );
    expect(calls[calls.length - 1]).toEqual(
      expect.objectContaining({
        entity: 'migration-job',
        brandId: 'homtone',
        metadata: expect.objectContaining({ status: 'completed', progress: 100 }),
      }),
    );
  });

  it('publishes failed event when underlying job throws', async () => {
    const { processor, lingxingClient, realtimeBus } = createProcessor();
    lingxingClient.listings.getListingsForShop.mockRejectedValueOnce(new Error('lingxing 5xx'));
    const job = makeJob({
      runId: 'patha-run-2',
      brandId: 'spoonlemon',
      marketCode: 'US',
      platformCode: 'amazon',
      shopIds: ['shop_1'],
    });

    await expect(processor.process(job)).rejects.toThrow('lingxing 5xx');

    const lastEvent = realtimeBus.publish.mock.calls.at(-1)?.[0];
    expect(lastEvent).toEqual(
      expect.objectContaining({
        entity: 'migration-job',
        brandId: 'spoonlemon',
        metadata: expect.objectContaining({
          status: 'failed',
          error: 'lingxing 5xx',
        }),
      }),
    );
  });
});
