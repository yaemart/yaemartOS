import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';

function createService() {
  const prisma = {
    systemConfig: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    brand: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    aiCallLog: {
      groupBy: vi.fn(),
    },
  };
  const prismaManager = { getPublicClient: () => prisma } as any;
  const config = { get: vi.fn() } as any;
  const realtimeBus = { publish: vi.fn().mockResolvedValue(undefined) } as any;

  const service = new SettingsService(prismaManager, config, realtimeBus);
  return { service, prisma, config, realtimeBus };
}

describe('SettingsService realtime publish (P0-D)', () => {
  it('upsert with brand-scoped key publishes a single brand-targeted event', async () => {
    const { service, prisma, realtimeBus } = createService();
    prisma.systemConfig.upsert.mockResolvedValue({ key: 'feature_flag.LISTING_AI.homtone' });

    await service.upsert(
      'feature_flag.LISTING_AI.homtone',
      'feature_flag',
      { value: 'true' },
      'user_1',
    );

    expect(realtimeBus.publish).toHaveBeenCalledTimes(1);
    expect(realtimeBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'system-config',
        action: 'update',
        brandId: 'homtone',
        ids: ['feature_flag.LISTING_AI.homtone'],
        actorType: 'user',
        actorId: 'user_1',
        metadata: expect.objectContaining({ category: 'feature_flag', brandScoped: true }),
      }),
    );
  });

  it('upsert with global key fans out to all 4 brands', async () => {
    const { service, prisma, realtimeBus } = createService();
    prisma.systemConfig.upsert.mockResolvedValue({ key: 'feature_flag.LISTING_AI' });

    await service.upsert('feature_flag.LISTING_AI', 'feature_flag', { value: 'false' });

    expect(realtimeBus.publish).toHaveBeenCalledTimes(4);
    const brandIdsPublished = realtimeBus.publish.mock.calls
      .map((call: unknown[]) => (call[0] as { brandId: string }).brandId)
      .sort();
    expect(brandIdsPublished).toEqual(['davivy', 'homtone', 'spoonlemon', 'tysun']);
    realtimeBus.publish.mock.calls.forEach((call: unknown[]) => {
      const event = call[0] as { actorType: string; metadata: Record<string, unknown> };
      expect(event.actorType).toBe('agent');
      expect(event.metadata).toEqual(
        expect.objectContaining({ category: 'feature_flag', brandScoped: false }),
      );
    });
  });

  it('updateBrandTheme publishes a single event scoped to the target brand', async () => {
    const { service, prisma, realtimeBus } = createService();
    prisma.brand.findUnique.mockResolvedValue({ id: 'tysun' });
    prisma.brand.update.mockResolvedValue({
      id: 'tysun',
      name: 'Tysun',
      slug: 'tysun',
      themeColor: '#16a34a',
      logoUrl: null,
    });

    await service.updateBrandTheme('tysun', { themeColor: '#16a34a', name: 'Tysun' }, 'user_admin');

    expect(realtimeBus.publish).toHaveBeenCalledTimes(1);
    expect(realtimeBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'system-config',
        action: 'update',
        brandId: 'tysun',
        ids: ['brand-theme.tysun'],
        actorType: 'user',
        actorId: 'user_admin',
        metadata: expect.objectContaining({
          category: 'brand_theme',
          brandScoped: true,
          themeColor: '#16a34a',
        }),
      }),
    );
  });

  it('updateBrandTheme throws NotFoundException for missing brand and does not publish', async () => {
    const { service, prisma, realtimeBus } = createService();
    prisma.brand.findUnique.mockResolvedValue(null);

    await expect(service.updateBrandTheme('ghost', { themeColor: '#000' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(realtimeBus.publish).not.toHaveBeenCalled();
  });
});
