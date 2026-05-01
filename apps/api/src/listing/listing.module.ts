import { Module } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { AiModule } from '../ai/ai.module';
import { IamModule } from '../iam/casbin.module';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';
import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';
import { ListingVersionService } from './listing-version.service';

@Module({
  imports: [IamModule, AiModule, FeatureFlagModule],
  controllers: [ListingController],
  providers: [ListingService, ListingVersionService, AuditService],
  exports: [ListingService, ListingVersionService],
})
export class ListingModule {}
