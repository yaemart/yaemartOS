import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('CUSTOMER_JWT_SECRET');
        if (!secret) {
          throw new Error(
            'CUSTOMER_JWT_SECRET is not configured. Set this env var before starting the server.',
          );
        }
        return { secret, signOptions: { expiresIn: '15m' } };
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
