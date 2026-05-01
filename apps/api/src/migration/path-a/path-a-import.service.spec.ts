import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../common/audit/audit.service';
import type { PrismaClientManager } from '../../database/prisma.service';
import { PathAImportService } from './path-a-import.service';
import type { PathANormalizedRecord } from './types';

class TestablePathAImportService extends PathAImportService {
  constructor(
    prismaManager: PrismaClientManager,
    auditService: AuditService,
    private readonly impl: (record: PathANormalizedRecord) => Promise<void>,
  ) {
    super(prismaManager, auditService);
  }

  protected async upsertNormalizedRecord(record: PathANormalizedRecord): Promise<void> {
    return this.impl(record);
  }
}

describe('PathAImportService', () => {
  it('deduplicates by sku and imports latest record only', async () => {
    const auditService = {
      logWrite: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const prismaManager = {} as PrismaClientManager;

    const upsert = vi.fn().mockResolvedValue(undefined);
    const service = new TestablePathAImportService(prismaManager, auditService, upsert);

    const summary = await service.importMappedRecords([
      {
        runId: 'run-001',
        sourceRecordId: 'a',
        sku: 'HT-SC-001',
        asin: null,
        title: 'old',
        bulletPoints: ['a'],
        description: '',
        searchTerms: [],
        marketplaceId: 'ATVPDKIKX0DER',
        lingxingShopId: null,
        brandName: 'Homtone',
        categoryName: 'Kitchen',
        lingxingUpdatedAt: '2026-05-01T10:00:00Z',
      },
      {
        runId: 'run-001',
        sourceRecordId: 'b',
        sku: 'HT-SC-001',
        asin: null,
        title: 'new',
        bulletPoints: ['b'],
        description: '',
        searchTerms: [],
        marketplaceId: 'ATVPDKIKX0DER',
        lingxingShopId: null,
        brandName: 'Homtone',
        categoryName: 'Kitchen',
        lingxingUpdatedAt: '2026-05-01T11:00:00Z',
      },
    ]);

    expect(summary.total).toBe(2);
    expect(summary.deduplicated).toBe(1);
    expect(summary.imported).toBe(1);
    expect(summary.failed).toBe(0);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('captures failures per sku without stopping the run', async () => {
    const auditService = {
      logWrite: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const prismaManager = {} as PrismaClientManager;

    const service = new TestablePathAImportService(prismaManager, auditService, async (record) => {
      if (record.sku === 'FAIL-SKU') {
        throw new Error('mock failure');
      }
    });

    const summary = await service.importMappedRecords([
      {
        runId: 'run-002',
        sourceRecordId: '1',
        sku: 'OK-SKU',
        asin: null,
        title: 'ok',
        bulletPoints: ['ok'],
        description: '',
        searchTerms: [],
        marketplaceId: 'ATVPDKIKX0DER',
        lingxingShopId: null,
        brandName: 'Homtone',
        categoryName: null,
        lingxingUpdatedAt: null,
      },
      {
        runId: 'run-002',
        sourceRecordId: '2',
        sku: 'FAIL-SKU',
        asin: null,
        title: 'fail',
        bulletPoints: ['f'],
        description: '',
        searchTerms: [],
        marketplaceId: 'ATVPDKIKX0DER',
        lingxingShopId: null,
        brandName: 'Homtone',
        categoryName: null,
        lingxingUpdatedAt: null,
      },
    ]);

    expect(summary.imported).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.failures[0]).toEqual({ sku: 'FAIL-SKU', reason: 'mock failure' });
  });
});
