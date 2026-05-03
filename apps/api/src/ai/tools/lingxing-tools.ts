import { tool } from 'ai';
import { z } from 'zod';
import type { IMcpToolCallService } from '../interfaces/mcp-tool-call.interface';

/** Serialisable descriptor for a Lingxing MCP tool — returned by GET /ai/mcp/tools. */
export type LingxingToolDescriptor = {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required: boolean }>;
};

/**
 * Machine-readable catalog of all Lingxing MCP tools.
 * Agents SHOULD call GET /ai/mcp/tools to discover these before constructing calls.
 * This list is the single source of truth; buildLingxingTools derives execute functions
 * from the same service interface.
 */
export const LINGXING_TOOL_DESCRIPTORS: LingxingToolDescriptor[] = [
  {
    name: 'inventoryQuery',
    description:
      'Query real-time FBA inventory snapshot for a specific shop and marketplace from Lingxing ERP.',
    parameters: {
      shopId: {
        type: 'string',
        description: 'The Lingxing shop ID to query inventory for',
        required: true,
      },
      marketplaceId: {
        type: 'string',
        description: 'The Amazon marketplace ID (e.g. ATVPDKIKX0DER for US)',
        required: true,
      },
    },
  },
  {
    name: 'listingSummary',
    description:
      'Get a listing summary (title, bullets, description, status, price) for a given ASIN from Lingxing ERP.',
    parameters: {
      asin: {
        type: 'string',
        description: 'The Amazon ASIN to look up',
        required: true,
      },
      shopId: {
        type: 'string',
        description: 'Optional shop ID to restrict access scope',
        required: false,
      },
    },
  },
  {
    name: 'keywordSuggestions',
    description:
      'Get backend keyword suggestions for a given ASIN based on the listing search terms in Lingxing ERP.',
    parameters: {
      asin: {
        type: 'string',
        description: 'The Amazon ASIN to get keyword suggestions for',
        required: true,
      },
    },
  },
];

export function buildLingxingTools(service: IMcpToolCallService) {
  return {
    inventoryQuery: tool({
      description:
        'Query real-time FBA inventory snapshot for a specific shop and marketplace from Lingxing ERP.',
      parameters: z.object({
        shopId: z.string().describe('The Lingxing shop ID to query inventory for'),
        marketplaceId: z.string().describe('The Amazon marketplace ID (e.g. ATVPDKIKX0DER for US)'),
      }),
      execute: async ({ shopId, marketplaceId }) =>
        service.queryInventory({ shopId, marketplaceId }),
    }),

    listingSummary: tool({
      description:
        'Get a listing summary (title, bullets, description, status, price) for a given ASIN from Lingxing ERP.',
      parameters: z.object({
        asin: z.string().describe('The Amazon ASIN to look up'),
        shopId: z.string().optional().describe('Optional shop ID to restrict access to'),
      }),
      execute: async ({ asin, shopId }) => service.getListingSummary({ asin, shopId }),
    }),

    keywordSuggestions: tool({
      description:
        'Get backend keyword suggestions for a given ASIN based on the listing search terms in Lingxing ERP.',
      parameters: z.object({
        asin: z.string().describe('The Amazon ASIN to get keyword suggestions for'),
      }),
      execute: async ({ asin }) => service.getKeywordSuggestions({ asin }),
    }),
  };
}
