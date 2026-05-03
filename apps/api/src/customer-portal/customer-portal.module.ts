import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';
import { MailModule } from '../mail/mail.module';
import { SearchModule } from '../search/search.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { TurnstileService } from '../common/captcha/turnstile.service';
import { ArticlePublicController } from './article-public/article-public.controller';
import { ArticlePublicService } from './article-public/article-public.service';
import { CustomerAuthController } from './customer-auth/customer-auth.controller';
import { CustomerAuthService } from './customer-auth/customer-auth.service';
import { CustomerGuard } from './customer-auth/customer.guard';
import { CustomerTenantGuard } from './customer-tenant.guard';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { TicketController } from './ticket/ticket.controller';
import { TicketService } from './ticket/ticket.service';
import { ManualController } from './manual/manual.controller';
import { ManualService } from './manual/manual.service';
import { WarrantyController } from './warranty/warranty.controller';
import { WarrantyService } from './warranty/warranty.service';
import { WarrantyReminderProcessor } from './warranty/warranty-reminder.processor';
import { WARRANTY_REMINDER_QUEUE } from './warranty/warranty-reminder.job';
import { OrderLookupController } from './order-lookup/order-lookup.controller';
import { OrderLookupService } from './order-lookup/order-lookup.service';

@Module({
  imports: [
    DatabaseModule,
    FeatureFlagModule,
    MailModule,
    SearchModule,
    CloudinaryModule,
    JwtModule.register({
      secret: process.env.CUSTOMER_JWT_SECRET ?? 'customer-changeme',
      signOptions: { expiresIn: '15m' },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 900000,
        limit: 5,
      },
    ]),
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
    BullModule.registerQueue({ name: WARRANTY_REMINDER_QUEUE }),
  ],
  controllers: [
    CustomerAuthController,
    ArticlePublicController,
    ChatController,
    TicketController,
    ManualController,
    WarrantyController,
    OrderLookupController,
  ],
  providers: [
    CustomerAuthService,
    CustomerTenantGuard,
    CustomerGuard,
    ArticlePublicService,
    ChatService,
    TicketService,
    ManualService,
    WarrantyService,
    WarrantyReminderProcessor,
    OrderLookupService,
    TurnstileService,
  ],
})
export class CustomerPortalModule {}
