import { Module } from '@nestjs/common';
import { AiRateLimitGuard } from './ai-rate-limit.guard';

@Module({
  providers: [AiRateLimitGuard],
  exports: [AiRateLimitGuard],
})
export class AiRateLimitModule {}
