import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { CustomerTenantGuard } from '../customer-tenant.guard';
import { CustomerAuthService } from './customer-auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

const RATE_LIMIT = { default: { limit: 5, ttl: 900000 } } as const;

@Controller('customer/auth')
@UseGuards(CustomerTenantGuard, ThrottlerGuard)
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
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.customerAuthService.verifyEmail(dto.token, this.tenantContext.getTenant());
  }

  @Post('resend-verification')
  @Throttle(RATE_LIMIT)
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.customerAuthService.resendVerification(dto.email, this.tenantContext.getTenant());
  }

  @Post('login')
  @Throttle(RATE_LIMIT)
  login(@Body() dto: LoginDto) {
    return this.customerAuthService.login(dto, this.tenantContext.getTenant());
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.customerAuthService.refreshTokens(dto.refreshToken, this.tenantContext.getTenant());
  }

  @Post('forgot-password')
  @Throttle(RATE_LIMIT)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.customerAuthService.forgotPassword(dto.email, this.tenantContext.getTenant());
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
