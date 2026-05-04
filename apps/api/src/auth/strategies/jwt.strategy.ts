import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy, type JwtFromRequestFunction } from 'passport-jwt';

type JwtPayload = {
  sub: string;
  email: string;
  brandId: string;
  role: string;
};

/**
 * Cookie extractor for SSE / EventSource clients.
 *
 * EventSource cannot send custom `Authorization` headers (W3C SSE spec).
 * To still authenticate the SSE handshake, we mint an HttpOnly `ya_sid`
 * cookie on `/auth/login` and read it here as a fallback when no Bearer
 * header is present. See ADR-011.
 */
const cookieExtractor: JwtFromRequestFunction = (req: Request) => {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.['ya_sid'] ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'dev-secret',
    });
  }

  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      email: payload.email,
      brandId: payload.brandId,
      role: payload.role,
    };
  }
}
