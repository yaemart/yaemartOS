import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IamModule } from '../iam/casbin.module';
import { MetricController } from './metric.controller';

@Module({
  imports: [DatabaseModule, IamModule],
  controllers: [MetricController],
})
export class MetricModule {}
