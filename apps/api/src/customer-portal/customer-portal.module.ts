import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '../database/database.module';
import { MailModule } from '../mail/mail.module';
import { CustomerAuthController } from './customer-auth/customer-auth.controller';
import { CustomerAuthService } from './customer-auth/customer-auth.service';
import { CustomerGuard } from './customer-auth/customer.guard';
import { CustomerTenantGuard } from './customer-tenant.guard';

@Module({
  imports: [
    DatabaseModule,
    MailModule,
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
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, CustomerTenantGuard, CustomerGuard],
})
export class CustomerPortalModule {}
