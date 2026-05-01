import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { HealthController } from './health.controller';

@Module({
  imports: [SearchModule],
  controllers: [HealthController],
})
export class HealthModule {}
