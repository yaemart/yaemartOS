import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ListingStatus, TrafficStrategy } from '../../generated/prisma';
import { describe, expect, it, vi } from 'vitest';
import { ListingService } from './listing.service';

function createService() {
  const prisma = {
    listing: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const prismaManager = {
    getPublicClient: () => prisma,
  } as any;

  const auditService = { logWrite: vi.fn() } as any;

  const service = new ListingService(prismaManager, auditService);
  return { service, prisma, auditService };
}

const baseListing = {
  id: 'lst_1',
  productId: 'prd_1',
  brandId: 'homtone',
  marketId: 'mkt_1',
  platformId: 'plt_1',
  shopId: 'shp_1',
  language: 'en',
  platformListingId: 'ASIN001',
  isPrimary: false,
  trafficStrategy: TrafficStrategy.primary,
  status: ListingStatus.draft,
  title: null,
  bullets: null,
  description: null,
  searchTerms: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ListingService', () => {
  describe('create', () => {
    it('creates a listing and returns it', async () => {
      const { service, prisma } = createService();

      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          listing: {
            create: vi.fn().mockResolvedValue(baseListing),
            updateMany: vi.fn(),
          },
        }),
      );
      prisma.listing.findUnique.mockResolvedValue({
        ...baseListing,
        product: {},
        versions: [],
      });

      const result = await service.create({
        productId: 'prd_1',
        brandId: 'homtone',
        marketId: 'mkt_1',
        platformId: 'plt_1',
        shopId: 'shp_1',
        language: 'en',
        platformListingId: 'ASIN001',
      });

      expect(result.id).toBe('lst_1');
    });

    it('throws ConflictException on P2002 (duplicate platformListingId)', async () => {
      const { service, prisma } = createService();

      prisma.$transaction.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.create({
          productId: 'prd_1',
          brandId: 'homtone',
          marketId: 'mkt_1',
          platformId: 'plt_1',
          shopId: 'shp_1',
          language: 'en',
          platformListingId: 'ASIN001',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update — status machine', () => {
    it('allows draft → review transition', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({ ...baseListing, status: ListingStatus.draft });
      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          listing: {
            update: vi.fn().mockResolvedValue({ ...baseListing, status: ListingStatus.review }),
            updateMany: vi.fn(),
          },
        }),
      );

      const result = await service.update('lst_1', { status: 'review' });
      expect(result.status).toBe(ListingStatus.review);
    });

    it('rejects draft → published (invalid jump)', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({ ...baseListing, status: ListingStatus.draft });

      await expect(service.update('lst_1', { status: 'published' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects any transition from archived (terminal state)', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({
        ...baseListing,
        status: ListingStatus.archived,
      });

      await expect(service.update('lst_1', { status: 'draft' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('allows full happy path: draft → review → approved → published', async () => {
      const { service, prisma } = createService();
      const transitions = [
        [ListingStatus.draft, 'review'],
        [ListingStatus.review, 'approved'],
        [ListingStatus.approved, 'published'],
      ] as const;

      for (const [currentStatus, nextStatus] of transitions) {
        prisma.listing.findUnique.mockResolvedValue({ ...baseListing, status: currentStatus });
        prisma.$transaction.mockImplementation(async (fn: any) =>
          fn({
            listing: {
              update: vi.fn().mockResolvedValue({ ...baseListing, status: nextStatus }),
              updateMany: vi.fn(),
            },
          }),
        );
        const result = await service.update('lst_1', { status: nextStatus });
        expect(result.status).toBe(nextStatus);
      }
    });
  });

  describe('isPrimary promotion', () => {
    it('demotes other listings when isPrimary is set to true', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({ ...baseListing, status: ListingStatus.draft });

      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const txUpdate = vi.fn().mockResolvedValue({ ...baseListing, isPrimary: true });

      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          listing: {
            update: txUpdate,
            updateMany: txUpdateMany,
          },
        }),
      );

      await service.update('lst_1', { isPrimary: true });

      expect(txUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 'lst_1' }, isPrimary: true }),
          data: { isPrimary: false },
        }),
      );
    });
  });

  describe('remove', () => {
    it('deletes archived listing successfully', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({
        ...baseListing,
        status: ListingStatus.archived,
      });
      prisma.listing.delete.mockResolvedValue(baseListing);

      const result = await service.remove('lst_1');
      expect(result.deleted).toBe(true);
    });

    it('throws BadRequestException when deleting non-archived listing', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({ ...baseListing, status: ListingStatus.draft });

      await expect(service.remove('lst_1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFoundException when listing does not exist', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.remove('lst_1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
