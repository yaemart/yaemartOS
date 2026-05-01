import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') ?? 'disabled-google-client-id',
      clientSecret:
        configService.get<string>('GOOGLE_CLIENT_SECRET') ?? 'disabled-google-client-secret',
      callbackURL:
        configService.get<string>('GOOGLE_CALLBACK_URL') ??
        'http://localhost:4000/auth/oauth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(_accessToken: string, _refreshToken: string, profile: any) {
    return {
      provider: 'google' as const,
      providerAccountId: profile.id,
      email: profile.emails?.[0]?.value,
    };
  }
}
