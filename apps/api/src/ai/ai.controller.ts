import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { IListingGenerationService } from './interfaces/listing-generation.interface';
import type { IMcpToolCallService } from './interfaces/mcp-tool-call.interface';
import { LISTING_GENERATION_SERVICE, MCP_TOOL_CALL_SERVICE } from './tokens';
import { LINGXING_TOOL_DESCRIPTORS } from './tools/lingxing-tools';

@Controller('ai')
export class AiController {
  constructor(
    @Inject(LISTING_GENERATION_SERVICE)
    private readonly listingGeneration: IListingGenerationService,
    @Inject(MCP_TOOL_CALL_SERVICE)
    private readonly mcp: IMcpToolCallService,
  ) {}

  @Get('hello')
  async hello() {
    const message = await this.listingGeneration.helloWorld();
    return { message };
  }

  /**
   * Returns the full structured descriptor for each Lingxing MCP tool.
   * Agents SHOULD call this endpoint to discover available tools, their
   * descriptions, and parameter schemas before constructing tool calls.
   */
  @Get('mcp/tools')
  @UseGuards(JwtAuthGuard)
  listMcpTools() {
    return { tools: LINGXING_TOOL_DESCRIPTORS };
  }

  @Post('mcp/query-inventory')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async queryInventory(@Body() body: { shopId: string; marketplaceId: string }) {
    return this.mcp.queryInventory(body);
  }

  @Post('mcp/listing-summary')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async getListingSummary(@Body() body: { asin: string; shopId?: string }) {
    return this.mcp.getListingSummary(body);
  }

  @Post('mcp/keyword-suggestions')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async getKeywordSuggestions(@Body() body: { asin: string }) {
    return this.mcp.getKeywordSuggestions(body);
  }
}
