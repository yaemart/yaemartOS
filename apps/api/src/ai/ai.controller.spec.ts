import { describe, expect, it, vi } from 'vitest';
import { AiController } from './ai.controller';
import { LINGXING_TOOL_DESCRIPTORS } from './tools/lingxing-tools';

function createController() {
  const listingGeneration = {
    helloWorld: vi.fn().mockResolvedValue('hello'),
  } as any;

  const mcp = {
    queryInventory: vi.fn(),
    getListingSummary: vi.fn(),
    getKeywordSuggestions: vi.fn(),
  } as any;

  const controller = new AiController(listingGeneration, mcp);
  return { controller, listingGeneration, mcp };
}

describe('AiController', () => {
  describe('GET /ai/mcp/tools', () => {
    it('returns the structured LINGXING_TOOL_DESCRIPTORS array', () => {
      const { controller } = createController();
      const result = controller.listMcpTools();
      expect(result.tools).toStrictEqual(LINGXING_TOOL_DESCRIPTORS);
    });

    it('returns 3 tool descriptors', () => {
      const { controller } = createController();
      const { tools } = controller.listMcpTools();
      expect(tools).toHaveLength(3);
    });

    it('each descriptor has name, description, and parameters fields', () => {
      const { controller } = createController();
      const { tools } = controller.listMcpTools();
      for (const tool of tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.parameters).toBe('object');
      }
    });

    it('inventoryQuery descriptor has required shopId and marketplaceId params', () => {
      const { controller } = createController();
      const { tools } = controller.listMcpTools();
      const inv = tools.find((t) => t.name === 'inventoryQuery');
      expect(inv).toBeDefined();
      expect(inv!.parameters.shopId.required).toBe(true);
      expect(inv!.parameters.marketplaceId.required).toBe(true);
    });

    it('listingSummary descriptor has optional shopId param', () => {
      const { controller } = createController();
      const { tools } = controller.listMcpTools();
      const ls = tools.find((t) => t.name === 'listingSummary');
      expect(ls).toBeDefined();
      expect(ls!.parameters.asin.required).toBe(true);
      expect(ls!.parameters.shopId.required).toBe(false);
    });
  });

  describe('POST /ai/mcp/query-inventory', () => {
    it('delegates to mcp.queryInventory with body params', async () => {
      const { controller, mcp } = createController();
      const inventory = [{ sku: 'SKU-1', quantity: 10 }];
      mcp.queryInventory.mockResolvedValue(inventory);

      const result = await controller.queryInventory({
        shopId: 'shop_1',
        marketplaceId: 'ATVPDKIKX0DER',
      });

      expect(result).toEqual(inventory);
      expect(mcp.queryInventory).toHaveBeenCalledWith({
        shopId: 'shop_1',
        marketplaceId: 'ATVPDKIKX0DER',
      });
    });
  });

  describe('POST /ai/mcp/keyword-suggestions', () => {
    it('delegates to mcp.getKeywordSuggestions', async () => {
      const { controller, mcp } = createController();
      mcp.getKeywordSuggestions.mockResolvedValue(['bluetooth speaker', 'wireless audio']);

      const result = await controller.getKeywordSuggestions({ asin: 'B001234567' });

      expect(result).toEqual(['bluetooth speaker', 'wireless audio']);
      expect(mcp.getKeywordSuggestions).toHaveBeenCalledWith({ asin: 'B001234567' });
    });
  });
});
