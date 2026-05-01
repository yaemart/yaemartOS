import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ListingVersionStatus } from '../generated/prisma';
import { describe, expect, it, vi } from 'vitest';
import { ListingVersionService } from './listing-version.service';

function createService() {
  const prisma = {
    listing: {
      findUnique: vi.fn(),
    },
    listingVersion: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const prismaManager = { getPublicClient: () => prisma } as any;
  const auditService = { logWrite: vi.fn() } as any;
  const service = new ListingVersionService(prismaManager, auditService);
  return { service, prisma, auditService };
}

const mockContent = {
  title: 'Homtone Slow Cooker',
  bullets: ['Bullet 1', 'Bullet 2', 'Bullet 3', 'Bullet 4', 'Bullet 5'],
  description: 'Great product',
  searchTerms: ['slow cooker'],
};

describe('ListingVersionService', () => {
  describe('createVersion', () => {
    it('increments version number sequentially', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({ id: 'lst_1' });

      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          listingVersion: {
            findFirst: vi.fn().mockResolvedValue({ versionNumber: 3 }),
            create: vi.fn().mockResolvedValue({
              id: 'ver_4',
              listingId: 'lst_1',
              versionNumber: 4,
              contentSnapshot: mockContent,
              status: ListingVersionStatus.draft,
              createdBy: null,
              createdAt: new Date(),
              publishedAt: null,
            }),
            updateMany: vi.fn(),
          },
        }),
      );

      const result = await service.createVersion('lst_1', mockContent);
      expect(result.versionNumber).toBe(4);
      expect(result.status).toBe(ListingVersionStatus.draft);
    });

    it('starts at version 1 for a new listing', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({ id: 'lst_1' });

      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          listingVersion: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'ver_1',
              listingId: 'lst_1',
              versionNumber: 1,
              contentSnapshot: mockContent,
              status: ListingVersionStatus.draft,
              createdBy: null,
              createdAt: new Date(),
              publishedAt: null,
            }),
            updateMany: vi.fn(),
          },
        }),
      );

      const result = await service.createVersion('lst_1', mockContent);
      expect(result.versionNumber).toBe(1);
    });

    it('throws NotFoundException when listing does not exist', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.createVersion('no_exist', mockContent)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('activateVersion', () => {
    it('activates a draft version and archives the previously active one', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({ id: 'lst_1' });

      const targetVersion = {
        id: 'ver_2',
        listingId: 'lst_1',
        versionNumber: 2,
        status: ListingVersionStatus.draft,
        contentSnapshot: mockContent,
        createdBy: null,
        createdAt: new Date(),
        publishedAt: null,
      };

      prisma.listingVersion.findUnique.mockResolvedValue(targetVersion);

      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      const txUpdate = vi.fn().mockResolvedValue({
        ...targetVersion,
        status: ListingVersionStatus.active,
        publishedAt: new Date(),
      });

      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          listingVersion: {
            updateMany: txUpdateMany,
            update: txUpdate,
          },
        }),
      );

      const result = await service.activateVersion('lst_1', 2);

      expect(txUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { listingId: 'lst_1', status: ListingVersionStatus.active },
          data: { status: ListingVersionStatus.archived },
        }),
      );
      expect(result.status).toBe(ListingVersionStatus.active);
    });

    it('throws NotFoundException when version does not exist', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({ id: 'lst_1' });
      prisma.listingVersion.findUnique.mockResolvedValue(null);

      await expect(service.activateVersion('lst_1', 99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when version is already active', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({ id: 'lst_1' });
      prisma.listingVersion.findUnique.mockResolvedValue({
        id: 'ver_1',
        status: ListingVersionStatus.active,
      });

      await expect(service.activateVersion('lst_1', 1)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ensures only one active version per listing at all times', async () => {
      const { service, prisma } = createService();
      prisma.listing.findUnique.mockResolvedValue({ id: 'lst_1' });

      const draftVersion = {
        id: 'ver_3',
        listingId: 'lst_1',
        versionNumber: 3,
        status: ListingVersionStatus.draft,
        contentSnapshot: mockContent,
        createdBy: null,
        createdAt: new Date(),
        publishedAt: null,
      };
      prisma.listingVersion.findUnique.mockResolvedValue(draftVersion);

      const txUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          listingVersion: {
            updateMany: txUpdateMany,
            update: vi
              .fn()
              .mockResolvedValue({ ...draftVersion, status: ListingVersionStatus.active }),
          },
        }),
      );

      await service.activateVersion('lst_1', 3);

      // Must archive any existing active versions before activating
      expect(txUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ListingVersionStatus.active }),
          data: { status: ListingVersionStatus.archived },
        }),
      );
    });
  });
});
