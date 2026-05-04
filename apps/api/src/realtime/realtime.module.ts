import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';
import { RealtimeBusService } from './realtime-bus.service';
import { RealtimeSseController } from './realtime-sse.controller';

/**
 * Realtime fanout module — see ADR-011.
 *
 * `@Global` so any mutation service (Listing, AdSuggestion, Shop, Settings,
 * Migration, Terminology, …) can inject `RealtimeBusService` without each
 * feature module re-importing this. The bus has zero side effects when
 * Redis is unreachable (fail-open), so dragging it into every module costs
 * nothing.
 */
@Global()
@Module({
  imports: [ConfigModule, AuthModule, FeatureFlagModule],
  providers: [RealtimeBusService],
  controllers: [RealtimeSseController],
  exports: [RealtimeBusService],
})
export class RealtimeModule {}
