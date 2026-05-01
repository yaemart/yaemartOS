import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('FACEBOOK_CLIENT_ID') ?? 'disabled-facebook-client-id',
      clientSecret:
        configService.get<string>('FACEBOOK_CLIENT_SECRET') ?? 'disabled-facebook-client-secret',
      callbackURL:
        configService.get<string>('FACEBOOK_CALLBACK_URL') ??
        'http://localhost:4000/auth/oauth/facebook/callback',
      profileFields: ['id', 'emails', 'name'],
      scope: ['email'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: any) {
    return {
      provider: 'facebook' as const,
      providerAccountId: profile.id,
      email: profile.emails?.[0]?.value,
    };
  }
}
