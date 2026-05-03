import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LingxingClientModule } from '@yaemartos/lingxing-client';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { TenantGuard } from './common/tenant/tenant.guard';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { CategoryModule } from './category/category.module';
import { ListingModule } from './listing/listing.module';
import { ProductModule } from './product/product.module';
import { SearchModule } from './search/search.module';
import { ShopModule } from './shop/shop.module';
import { MigrationModule } from './migration/migration.module';
import { SettingsModule } from './settings/settings.module';
import { LocaleModule } from './locale/locale.module';
import { MarketModule } from './market/market.module';
import { PlatformModule } from './platform/platform.module';
import { TerminologyModule } from './terminology/terminology.module';
import { MailModule } from './mail/mail.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { AdminModule } from './admin/admin.module';
import { AdSyncModule } from './ad-sync/ad-sync.module';
import { AdDashboardModule } from './ad-dashboard/ad-dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? 'info',
      },
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    LingxingClientModule.forRoot({
      appKey: process.env.LINGXING_APP_KEY ?? '',
      appSecret: process.env.LINGXING_APP_SECRET ?? '',
      baseUrl: process.env.LINGXING_BASE_URL ?? 'https://openapi.lingxing.com',
      redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
      allowedShopIds: process.env.LINGXING_ALLOWED_SHOP_IDS?.split(',').filter(Boolean) ?? [],
    }),
    DatabaseModule,
    HealthModule,
    AiModule,
    AuthModule,
    CloudinaryModule,
    SearchModule,
    CategoryModule,
    ProductModule,
    ListingModule,
    ShopModule,
    MigrationModule,
    SettingsModule,
    LocaleModule,
    MarketModule,
    PlatformModule,
    TerminologyModule,
    MailModule,
    CustomerPortalModule,
    AdminModule,
    AdSyncModule,
    AdDashboardModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
