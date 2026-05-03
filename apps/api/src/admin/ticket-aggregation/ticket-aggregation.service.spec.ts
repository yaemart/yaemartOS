import { describe, it, expect, vi } from 'vitest';
import { TicketAggregationService } from './ticket-aggregation.service';
import { PrismaClientManager } from '../../database/prisma.service';

const MOCK_TICKET_HT = {
  id: 'ht-1',
  ticketNo: 'HO-20260503-0001',
  subject: 'Broken blender',
  status: 'open',
  priority: 'normal',
  tags: [],
  createdAt: new Date('2026-05-03T10:00:00Z'),
  updatedAt: new Date('2026-05-03T10:00:00Z'),
  customerId: 'cust-ht-1',
  assigneeId: null,
};

const MOCK_TICKET_SL = {
  id: 'sl-1',
  ticketNo: 'SP-20260503-0001',
  subject: 'Missing accessory',
  status: 'in_progress',
  priority: 'high',
  tags: ['accessory'],
  createdAt: new Date('2026-05-03T09:00:00Z'),
  updatedAt: new Date('2026-05-03T09:00:00Z'),
  customerId: 'cust-sl-1',
  assigneeId: 'agent-1',
};

function makeService(opts?: { failSchemas?: string[] }) {
  const mockClients: Record<string, unknown> = {
    homtone: {
      ticket: {
        findMany: vi.fn().mockResolvedValue([MOCK_TICKET_HT]),
      },
    },
    spoonlemon: {
      ticket: {
        findMany: vi.fn().mockResolvedValue([MOCK_TICKET_SL]),
      },
    },
    davivy: {
      ticket: {
        findMany: opts?.failSchemas?.includes('davivy')
          ? vi.fn().mockRejectedValue(new Error('DB timeout'))
          : vi.fn().mockResolvedValue([]),
      },
    },
    tysun: {
      ticket: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };

  const mockManager = {
    getTenantClient: vi.fn((schema: string) => mockClients[schema]),
  } as unknown as PrismaClientManager;

  const service = new TicketAggregationService(mockManager);
  return { service, mockManager, mockClients };
}

describe('TicketAggregationService', () => {
  describe('findAll', () => {
    it('returns tickets from all tenant schemas merged and sorted by createdAt desc', async () => {
      const { service } = makeService();
      const result = await service.findAll();
      expect(result.results).toHaveLength(2);
      expect(result.results[0]!.brand).toBe('homtone');
      expect(result.results[1]!.brand).toBe('spoonlemon');
      expect(result.partialFailures).toHaveLength(0);
    });

    it('filters by brandId when specified', async () => {
      const { service } = makeService();
      const result = await service.findAll({ brandId: 'homtone' });
      expect(result.results).toHaveLength(1);
      expect(result.results[0]!.brand).toBe('homtone');
    });

    it('returns partialFailures for failing schemas without throwing', async () => {
      const { service } = makeService({ failSchemas: ['davivy'] });
      const result = await service.findAll();
      expect(result.partialFailures).toContain('davivy');
      expect(result.results.length).toBeGreaterThanOrEqual(2);
    });

    it('paginates results correctly', async () => {
      const { service } = makeService();
      const result = await service.findAll({ page: 1, limit: 1 });
      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(2);
    });

    it('adds brand field to each ticket', async () => {
      const { service } = makeService();
      const result = await service.findAll({ brandId: 'spoonlemon' });
      expect(result.results[0]!.brand).toBe('spoonlemon');
    });
  });
});
