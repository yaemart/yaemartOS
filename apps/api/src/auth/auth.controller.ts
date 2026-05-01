import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
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
import { AuthUser } from './auth.types';

type AuthRequestUser = {
  id: string;
  email: string;
  brandId: string;
  role: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(LocalAuthGuard)
  async login(@Body() _body: LoginDto, @Req() req: Request) {
    return this.authService.loginWithUser(req.user as AuthUser);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refresh(body.refreshToken);
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
  async googleCallback(@Req() req: Request) {
    return this.authService.oauthLogin(req.user as any);
  }

  @Get('oauth/facebook')
  @UseGuards(AuthGuard('facebook'))
  async facebookLogin() {
    return { status: 'redirecting' };
  }

  @Get('oauth/facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  async facebookCallback(@Req() req: Request) {
    return this.authService.oauthLogin(req.user as any);
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
