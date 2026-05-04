import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { CasbinGuard } from '../iam/casbin.guard';
import { applyFieldMask } from '../common/field-mask/field-mask.util';
import { AuthUser, TokenPair } from './auth.types';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const COOKIE_NAME = 'ya_sid';

type AuthRequestUser = {
  id: string;
  email: string;
  brandId: string;
  role: string;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sets the HttpOnly `ya_sid` cookie alongside the JSON token response.
   *
   * The cookie is only used by SSE / EventSource handshakes (which cannot
   * send Authorization headers per W3C). All existing API callers continue
   * to authenticate via the Bearer token returned in the JSON body. See
   * ADR-011.
   */
  private setSessionCookie(res: Response, accessToken: string): void {
    res.cookie(COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.parseAccessTokenMaxAge(),
      path: '/',
    });
  }

  private parseAccessTokenMaxAge(): number {
    const raw = this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m';
    // Accept '15m' / '900s' / raw seconds-as-number string. Default 15m
    // matches AuthService.issueTokens default.
    if (/^\d+$/.test(raw)) {
      return Number(raw) * 1000;
    }
    const match = raw.match(/^(\d+)\s*([smhd])$/);
    if (!match) {
      return FIFTEEN_MINUTES_MS;
    }
    const value = Number(match[1]);
    switch (match[2]) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return FIFTEEN_MINUTES_MS;
    }
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(LocalAuthGuard)
  async login(
    @Body() _body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenPair> {
    const tokens = await this.authService.loginWithUser(req.user as AuthUser);
    this.setSessionCookie(res, tokens.accessToken);
    return tokens;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Body() body: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TokenPair> {
    const tokens = await this.authService.refresh(body.refreshToken);
    this.setSessionCookie(res, tokens.accessToken);
    return tokens;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Res({ passthrough: true }) res: Response): Promise<void> {
    res.clearCookie(COOKIE_NAME, { path: '/' });
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard)
  async invite(@Body() body: InviteUserDto) {
    return this.authService.createInvitation(body);
  }

  @Post('accept-invite')
  async acceptInvite(@Body() body: AcceptInviteDto) {
    return this.authService.acceptInvitation(body.token, body.password);
  }

  @Get('oauth/google')
  @UseGuards(AuthGuard('google'))
  async googleLogin() {
    return { status: 'redirecting' };
  }

  @Get('oauth/google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.oauthLogin(req.user as any);
    this.setSessionCookie(res, tokens.accessToken);
    return tokens;
  }

  @Get('oauth/facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookLogin() {
    return { status: 'redirecting' };
  }

  @Get('oauth/facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.oauthLogin(req.user as any);
    this.setSessionCookie(res, tokens.accessToken);
    return tokens;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, CasbinGuard)
  @RequirePolicy({ obj: 'auth:me', act: 'read', field: '*' })
  async me(@Req() req: Request) {
    const user = req.user as AuthRequestUser;
    const mask = ((req as any).allowedFields as string[] | undefined) ?? [
      'id',
      'email',
      'brandId',
      'role',
    ];
    return applyFieldMask(user, mask);
  }
}
