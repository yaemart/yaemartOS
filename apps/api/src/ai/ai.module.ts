import { Module } from '@nestjs/common';
import { GeminiListingGenerationService } from './providers/gemini-listing-generation.service';
import { LingxingMcpToolService } from './providers/lingxing-mcp-tool.service';
import { AiController } from './ai.controller';
import {
  LISTING_GENERATION_SERVICE,
  MCP_TOOL_CALL_SERVICE,
  STRUCTURED_EXTRACTION_SERVICE,
} from './tokens';
import type { IStructuredExtractionService } from './interfaces/structured-extraction.interface';
import { AuditService } from '../common/audit/audit.service';

class StubStructuredExtractionService implements IStructuredExtractionService {
  async ping(): Promise<'ok'> {
    return 'ok';
  }
}

@Module({
  controllers: [AiController],
  providers: [
    GeminiListingGenerationService,
    AuditService,
    LingxingMcpToolService,
    {
      provide: LISTING_GENERATION_SERVICE,
      useExisting: GeminiListingGenerationService,
    },
    {
      provide: MCP_TOOL_CALL_SERVICE,
      useExisting: LingxingMcpToolService,
    },
    { provide: STRUCTURED_EXTRACTION_SERVICE, useClass: StubStructuredExtractionService },
  ],
  exports: [LISTING_GENERATION_SERVICE, MCP_TOOL_CALL_SERVICE, STRUCTURED_EXTRACTION_SERVICE],
})
export class AiModule {}
