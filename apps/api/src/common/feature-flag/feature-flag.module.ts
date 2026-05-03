import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { FeatureFlagService } from './feature-flag.service';

@Module({
  imports: [DatabaseModule],
  providers: [FeatureFlagService],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
