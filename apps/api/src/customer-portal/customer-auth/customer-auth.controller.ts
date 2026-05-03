import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { CustomerTenantGuard } from '../customer-tenant.guard';
import { CustomerAuthService } from './customer-auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const RATE_LIMIT = { default: { limit: 5, ttl: 900000 } } as const;

@Controller('customer/auth')
@UseGuards(CustomerTenantGuard)
export class CustomerAuthController {
  constructor(
    private readonly customerAuthService: CustomerAuthService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post('register')
  @Throttle(RATE_LIMIT)
  register(@Body() dto: RegisterDto) {
    return this.customerAuthService.register(dto, this.tenantContext.getTenant());
  }

  @Post('verify-email')
  verifyEmail(@Body('token') token: string) {
    return this.customerAuthService.verifyEmail(token, this.tenantContext.getTenant());
  }

  @Post('resend-verification')
  @Throttle(RATE_LIMIT)
  resendVerification(@Body('email') email: string) {
    return this.customerAuthService.resendVerification(email, this.tenantContext.getTenant());
  }

  @Post('login')
  @Throttle(RATE_LIMIT)
  login(@Body() dto: LoginDto) {
    return this.customerAuthService.login(dto, this.tenantContext.getTenant());
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.customerAuthService.refreshTokens(refreshToken, this.tenantContext.getTenant());
  }

  @Post('forgot-password')
  @Throttle(RATE_LIMIT)
  forgotPassword(@Body('email') email: string) {
    return this.customerAuthService.forgotPassword(email, this.tenantContext.getTenant());
  }

  @Get('validate-reset-token')
  validateResetToken(@Query('token') token: string) {
    return this.customerAuthService.validateResetToken(token, this.tenantContext.getTenant());
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.customerAuthService.resetPassword(dto, this.tenantContext.getTenant());
  }
}
