import { Module } from '@nestjs/common';
import { GeminiListingGenerationService } from './providers/gemini-listing-generation.service';
import { AiController } from './ai.controller';
import {
  LISTING_GENERATION_SERVICE,
  MCP_TOOL_CALL_SERVICE,
  STRUCTURED_EXTRACTION_SERVICE,
} from './tokens';
import type { IMcpToolCallService } from './interfaces/mcp-tool-call.interface';
import type { IStructuredExtractionService } from './interfaces/structured-extraction.interface';

class StubMcpToolCallService implements IMcpToolCallService {
  async ping(): Promise<'ok'> {
    return 'ok';
  }
}

class StubStructuredExtractionService implements IStructuredExtractionService {
  async ping(): Promise<'ok'> {
    return 'ok';
  }
}

@Module({
  controllers: [AiController],
  providers: [
    GeminiListingGenerationService,
    {
      provide: LISTING_GENERATION_SERVICE,
      useExisting: GeminiListingGenerationService,
    },
    { provide: MCP_TOOL_CALL_SERVICE, useClass: StubMcpToolCallService },
    { provide: STRUCTURED_EXTRACTION_SERVICE, useClass: StubStructuredExtractionService },
  ],
  exports: [LISTING_GENERATION_SERVICE, MCP_TOOL_CALL_SERVICE, STRUCTURED_EXTRACTION_SERVICE],
})
export class AiModule {}
