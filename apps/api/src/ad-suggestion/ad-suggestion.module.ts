import { Module } from '@nestjs/common';
import { IamModule } from '../iam/casbin.module';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';
import { AiModule } from '../ai/ai.module';
import { AuditService } from '../common/audit/audit.service';
import { AdSuggestionController } from './ad-suggestion.controller';
import { AdSuggestionService } from './ad-suggestion.service';

@Module({
  imports: [IamModule, FeatureFlagModule, AiModule],
  controllers: [AdSuggestionController],
  providers: [AdSuggestionService, AuditService],
  exports: [AdSuggestionService],
})
export class AdSuggestionModule {}
