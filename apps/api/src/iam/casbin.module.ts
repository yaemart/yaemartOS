import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';
import { CasbinGuard } from './casbin.guard';
import { CasbinService } from './casbin.service';
import { IamController } from './iam.controller';

@Module({
  imports: [DatabaseModule, FeatureFlagModule],
  controllers: [IamController],
  providers: [Reflector, CasbinService, CasbinGuard],
  exports: [CasbinService, CasbinGuard],
})
export class IamModule {}
