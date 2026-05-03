import { Module } from '@nestjs/common';
import { IamModule } from '../iam/casbin.module';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';
import { AdDashboardController } from './ad-dashboard.controller';
import { AdDashboardService } from './ad-dashboard.service';

@Module({
  imports: [IamModule, FeatureFlagModule],
  controllers: [AdDashboardController],
  providers: [AdDashboardService],
  exports: [AdDashboardService],
})
export class AdDashboardModule {}
