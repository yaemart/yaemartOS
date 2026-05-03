import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { TENANT_HEADER } from '../../common/tenant/tenant.constants';

interface CustomerJwtPayload {
  sub: string;
  email: string;
  brand: string;
  aud: string | string[];
}

@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cls: ClsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7);
    let payload: CustomerJwtPayload;

    try {
      payload = this.jwtService.verify<CustomerJwtPayload>(token, {
        secret: process.env.CUSTOMER_JWT_SECRET ?? 'customer-changeme',
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
    if (aud !== 'customer') {
      throw new ForbiddenException('Invalid token audience');
    }

    const rawBrand = req.headers[TENANT_HEADER];
    const brand = Array.isArray(rawBrand) ? rawBrand[0] : rawBrand;

    if (payload.brand !== brand) {
      throw new ForbiddenException('Token brand mismatch');
    }

    this.cls.set('customerId', payload.sub);
    return true;
  }
}
