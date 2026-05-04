import { Module } from '@nestjs/common';
import { GeminiListingGenerationService } from './providers/gemini-listing-generation.service';
import { GlmGenerationService } from './providers/glm-generation.service';
import { FaqGenerationService } from './providers/faq-generation.service';
import { LingxingMcpToolService } from './providers/lingxing-mcp-tool.service';
import { ModelRouterService } from './model-router.service';
import { CostTrackingService } from './cost-tracking.service';
import { EmbeddingService } from './embedding.service';
import { AiController } from './ai.controller';
import {
  LISTING_GENERATION_SERVICE,
  MCP_TOOL_CALL_SERVICE,
  STRUCTURED_EXTRACTION_SERVICE,
  FAQ_GENERATION_SERVICE,
} from './tokens';
import type { IStructuredExtractionService } from './interfaces/structured-extraction.interface';
import { AuditService } from '../common/audit/audit.service';
import { DatabaseModule } from '../database/database.module';
import { AiRateLimitModule } from './rate-limit/ai-rate-limit.module';

class StubStructuredExtractionService implements IStructuredExtractionService {
  async ping(): Promise<'ok'> {
    return 'ok';
  }
}

@Module({
  imports: [DatabaseModule, AiRateLimitModule],
  controllers: [AiController],
  providers: [
    GeminiListingGenerationService,
    GlmGenerationService,
    FaqGenerationService,
    ModelRouterService,
    CostTrackingService,
    EmbeddingService,
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
    {
      provide: FAQ_GENERATION_SERVICE,
      useExisting: FaqGenerationService,
    },
    { provide: STRUCTURED_EXTRACTION_SERVICE, useClass: StubStructuredExtractionService },
  ],
  exports: [
    LISTING_GENERATION_SERVICE,
    MCP_TOOL_CALL_SERVICE,
    STRUCTURED_EXTRACTION_SERVICE,
    FAQ_GENERATION_SERVICE,
    GlmGenerationService,
    ModelRouterService,
    CostTrackingService,
    EmbeddingService,
    AiRateLimitModule,
  ],
})
export class AiModule {}
