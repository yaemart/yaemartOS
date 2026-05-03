import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '../database/database.module';
import { FeatureFlagModule } from '../common/feature-flag/feature-flag.module';
import { MailModule } from '../mail/mail.module';
import { SearchModule } from '../search/search.module';
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

@Module({
  imports: [
    DatabaseModule,
    FeatureFlagModule,
    MailModule,
    SearchModule,
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
  ],
  controllers: [CustomerAuthController, ArticlePublicController, ChatController, TicketController],
  providers: [
    CustomerAuthService,
    CustomerTenantGuard,
    CustomerGuard,
    ArticlePublicService,
    ChatService,
    TicketService,
  ],
})
export class CustomerPortalModule {}
