import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LingxingMcpBridge } from '../src/mcp/mcp-bridge';
import { BusinessError } from '../src/errors/lingxing-error';

function createMockClient() {
  return {
    inventory: {
      getSnapshot: vi.fn(),
    },
    listings: {
      getByAsin: vi.fn(),
    },
  } as any;
}

function createBridge(allowedShopIds: string[] = []) {
  const client = createMockClient();
  const options = { appKey: '', appSecret: '', baseUrl: '', redisUrl: '', allowedShopIds };
  const bridge = new LingxingMcpBridge(client, options);
  return { bridge, client };
}

describe('LingxingMcpBridge', () => {
  describe('queryInventory', () => {
    it('calls inventory.getSnapshot and returns results', async () => {
      const { bridge, client } = createBridge();
      const mockInventory = [{ sku: 'HT-SC-001', fbaAvailable: 150 }];
      client.inventory.getSnapshot.mockResolvedValue(mockInventory);

      const result = await bridge.queryInventory({
        shopId: 'shop-1',
        marketplaceId: 'ATVPDKIKX0DER',
      });

      expect(client.inventory.getSnapshot).toHaveBeenCalledWith('ATVPDKIKX0DER');
      expect(result).toEqual(mockInventory);
    });

    it('passes any shopId when allowedShopIds is empty', async () => {
      const { bridge, client } = createBridge([]);
      client.inventory.getSnapshot.mockResolvedValue([]);

      await expect(
        bridge.queryInventory({ shopId: 'any-shop', marketplaceId: 'ATVPDKIKX0DER' }),
      ).resolves.not.toThrow();
    });

    it('throws BusinessError when shopId not in allowedShopIds', async () => {
      const { bridge } = createBridge(['allowed-shop-1', 'allowed-shop-2']);

      await expect(
        bridge.queryInventory({ shopId: 'forbidden-shop', marketplaceId: 'ATVPDKIKX0DER' }),
      ).rejects.toThrow(BusinessError);
    });

    it('allows shopId that is in allowedShopIds', async () => {
      const { bridge, client } = createBridge(['allowed-shop-1']);
      client.inventory.getSnapshot.mockResolvedValue([]);

      await expect(
        bridge.queryInventory({ shopId: 'allowed-shop-1', marketplaceId: 'ATVPDKIKX0DER' }),
      ).resolves.not.toThrow();
    });
  });

  describe('getListingSummary', () => {
    it('calls listings.getByAsin and returns mapped listing', async () => {
      const { bridge, client } = createBridge();
      const mockListing = {
        platformListingId: 'B09XYZ1234',
        sku: 'HT-SC-001',
        searchTerms: ['slow cooker'],
      };
      client.listings.getByAsin.mockResolvedValue(mockListing);

      const result = await bridge.getListingSummary({ asin: 'B09XYZ1234' });

      expect(client.listings.getByAsin).toHaveBeenCalledWith('B09XYZ1234');
      expect(result).toEqual(mockListing);
    });

    it('returns null when listing does not exist', async () => {
      const { bridge, client } = createBridge();
      client.listings.getByAsin.mockResolvedValue(null);

      const result = await bridge.getListingSummary({ asin: 'NONEXISTENT' });

      expect(result).toBeNull();
    });

    it('validates shopId when provided', async () => {
      const { bridge } = createBridge(['allowed-shop']);

      await expect(
        bridge.getListingSummary({ asin: 'B09XYZ1234', shopId: 'forbidden-shop' }),
      ).rejects.toThrow(BusinessError);
    });

    it('skips shopId validation when shopId not provided', async () => {
      const { bridge, client } = createBridge(['allowed-shop']);
      client.listings.getByAsin.mockResolvedValue(null);

      await expect(bridge.getListingSummary({ asin: 'B09XYZ1234' })).resolves.not.toThrow();
    });
  });

  describe('getKeywordSuggestions', () => {
    it('returns searchTerms from listing', async () => {
      const { bridge, client } = createBridge();
      client.listings.getByAsin.mockResolvedValue({
        platformListingId: 'B09XYZ1234',
        searchTerms: ['slow cooker', 'programmable', '6 quart'],
      });

      const result = await bridge.getKeywordSuggestions({ asin: 'B09XYZ1234' });

      expect(result).toEqual(['slow cooker', 'programmable', '6 quart']);
    });

    it('returns empty array when listing does not exist', async () => {
      const { bridge, client } = createBridge();
      client.listings.getByAsin.mockResolvedValue(null);

      const result = await bridge.getKeywordSuggestions({ asin: 'NONEXISTENT' });

      expect(result).toEqual([]);
    });

    it('returns empty array when listing has no searchTerms', async () => {
      const { bridge, client } = createBridge();
      client.listings.getByAsin.mockResolvedValue({
        platformListingId: 'B09XYZ1234',
        searchTerms: [],
      });

      const result = await bridge.getKeywordSuggestions({ asin: 'B09XYZ1234' });

      expect(result).toEqual([]);
    });
  });
});
