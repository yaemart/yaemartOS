import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type TenantSchema } from '@yaemartos/db';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaClientManager } from '../../database/prisma.service';
import { MailService } from '../../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_DAYS = 30;
const VERIFICATION_TOKEN_HOURS = 24;
const RESET_TOKEN_HOURS = 1;

interface CustomerRow {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  name: string | null;
  email_verified_at: Date | null;
}

interface EmailVerificationRow {
  id: string;
  customer_id: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
}

interface PasswordResetRow {
  id: string;
  customer_id: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
}

interface RefreshTokenRow {
  id: string;
  customer_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  private db(tenantId: string) {
    return this.prismaManager.getTenantClient(tenantId as TenantSchema);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueAccessToken(
    customerId: string,
    email: string,
    tenantId: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: customerId, email, brand: tenantId, aud: 'customer' },
      {
        secret: process.env.CUSTOMER_JWT_SECRET ?? 'customer-changeme',
        expiresIn: '15m',
      },
    );
  }

  async register(dto: RegisterDto, tenantId: string): Promise<{ message: string }> {
    const db = this.db(tenantId);

    const existing = await db.$queryRaw<CustomerRow[]>`
      SELECT id FROM customer WHERE email = ${dto.email} LIMIT 1
    `;
    if (existing.length > 0) {
      throw new ConflictException({ code: 'CUSTOMER_ALREADY_EXISTS' });
    }

    const passwordHash = await hash(dto.password, BCRYPT_ROUNDS);
    const customerId = randomBytes(16).toString('hex');
    const now = new Date();

    await db.$executeRaw`
      INSERT INTO customer (id, email, password_hash, name, is_active, created_at, updated_at)
      VALUES (${customerId}, ${dto.email}, ${passwordHash}, ${dto.name ?? null}, false, ${now}, ${now})
    `;

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_HOURS * 3600 * 1000);

    await db.$executeRaw`
      INSERT INTO customer_email_verification (id, customer_id, token, expires_at, created_at)
      VALUES (gen_random_uuid()::text, ${customerId}, ${token}, ${expiresAt}, ${now})
    `;

    await this.mailService.sendVerification(dto.email, token, tenantId, 'zh');
    return { message: 'VERIFICATION_EMAIL_SENT' };
  }

  async verifyEmail(token: string, tenantId: string): Promise<{ message: string }> {
    const db = this.db(tenantId);
    const now = new Date();

    // Atomic claim: mark the token as used in a single conditional UPDATE.
    // Returns the row only if the token existed, was unused, and has not expired.
    const claimed = await db.$queryRaw<Pick<EmailVerificationRow, 'id' | 'customer_id'>[]>`
      UPDATE customer_email_verification
      SET used_at = ${now}
      WHERE token = ${token}
        AND used_at IS NULL
        AND expires_at > ${now}
      RETURNING id, customer_id
    `;

    if (claimed.length === 0) {
      // Distinguish "token existed but already used/expired" vs "never existed".
      const existing = await db.$queryRaw<Pick<EmailVerificationRow, 'used_at' | 'expires_at'>[]>`
        SELECT used_at, expires_at FROM customer_email_verification WHERE token = ${token} LIMIT 1
      `;
      if (existing.length === 0) {
        throw new BadRequestException({ code: 'TOKEN_ALREADY_USED' });
      }
      if (existing[0].expires_at < now) {
        throw new BadRequestException({ code: 'TOKEN_EXPIRED' });
      }
      throw new BadRequestException({ code: 'TOKEN_ALREADY_USED' });
    }

    const { customer_id: customerId } = claimed[0];

    await db.$executeRaw`
      UPDATE customer SET is_active = true, email_verified_at = ${now}, updated_at = ${now}
      WHERE id = ${customerId}
    `;

    return { message: 'EMAIL_VERIFIED' };
  }

  async resendVerification(email: string, tenantId: string): Promise<{ message: string }> {
    const db = this.db(tenantId);

    const rows = await db.$queryRaw<CustomerRow[]>`
      SELECT id, email, is_active FROM customer WHERE email = ${email} LIMIT 1
    `;

    if (rows.length === 0 || rows[0].is_active) {
      return { message: 'VERIFICATION_EMAIL_SENT' };
    }

    const customer = rows[0];
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_HOURS * 3600 * 1000);
    const now = new Date();

    await db.$executeRaw`
      INSERT INTO customer_email_verification (id, customer_id, token, expires_at, created_at)
      VALUES (gen_random_uuid()::text, ${customer.id}, ${token}, ${expiresAt}, ${now})
    `;

    await this.mailService.sendVerification(customer.email, token, tenantId, 'zh');
    return { message: 'VERIFICATION_EMAIL_SENT' };
  }

  async login(
    dto: LoginDto,
    tenantId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const db = this.db(tenantId);

    const rows = await db.$queryRaw<CustomerRow[]>`
      SELECT id, email, password_hash, is_active FROM customer WHERE email = ${dto.email} LIMIT 1
    `;

    if (rows.length === 0) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const customer = rows[0];
    const isValid = await compare(dto.password, customer.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!customer.is_active) {
      throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED' });
    }

    const accessToken = await this.issueAccessToken(customer.id, customer.email, tenantId);
    const refreshToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 3600 * 1000);
    const now = new Date();

    await db.$executeRaw`
      INSERT INTO customer_refresh_token (id, customer_id, token_hash, expires_at, created_at)
      VALUES (gen_random_uuid()::text, ${customer.id}, ${tokenHash}, ${expiresAt}, ${now})
    `;

    return { accessToken, refreshToken };
  }

  async refreshTokens(
    rawToken: string,
    tenantId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const db = this.db(tenantId);
    const tokenHash = this.hashToken(rawToken);

    const rows = await db.$queryRaw<Array<RefreshTokenRow & { email: string }>>`
      SELECT rt.id, rt.customer_id, rt.expires_at, rt.revoked_at, c.email
      FROM customer_refresh_token rt
      JOIN customer c ON c.id = rt.customer_id
      WHERE rt.token_hash = ${tokenHash}
      LIMIT 1
    `;

    if (rows.length === 0 || rows[0].revoked_at !== null || rows[0].expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    const existing = rows[0];
    const newRefreshToken = randomBytes(32).toString('hex');
    const newTokenHash = this.hashToken(newRefreshToken);
    const accessToken = await this.issueAccessToken(existing.customer_id, existing.email, tenantId);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 3600 * 1000);
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE customer_refresh_token SET revoked_at = ${now} WHERE id = ${existing.id}
      `;
      await tx.$executeRaw`
        INSERT INTO customer_refresh_token (id, customer_id, token_hash, expires_at, created_at)
        VALUES (gen_random_uuid()::text, ${existing.customer_id}, ${newTokenHash}, ${newExpiresAt}, ${now})
      `;
    });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async forgotPassword(email: string, tenantId: string): Promise<{ message: string }> {
    const db = this.db(tenantId);

    const rows = await db.$queryRaw<CustomerRow[]>`
      SELECT id, email, is_active FROM customer WHERE email = ${email} LIMIT 1
    `;

    if (rows.length > 0 && rows[0].is_active) {
      const customer = rows[0];
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_HOURS * 3600 * 1000);
      const now = new Date();

      await db.$executeRaw`
        INSERT INTO customer_password_reset (id, customer_id, token, expires_at, created_at)
        VALUES (gen_random_uuid()::text, ${customer.id}, ${token}, ${expiresAt}, ${now})
      `;

      // Mail failures are caught narrowly so the caller still gets 200 (prevents
      // distinguishing "email sent" from "email not found"), but DB/infra failures
      // propagate normally as 5xx.
      try {
        await this.mailService.sendPasswordReset(customer.email, token, tenantId, 'zh');
      } catch {
        // SMTP failure: token is stored in DB so the user can retry; log via MailService.
      }
    }

    // Always return 200 regardless of whether the email existed — prevents enumeration.
    return { message: 'PASSWORD_RESET_EMAIL_SENT' };
  }

  async validateResetToken(token: string, tenantId: string): Promise<{ valid: boolean }> {
    const db = this.db(tenantId);

    const rows = await db.$queryRaw<PasswordResetRow[]>`
      SELECT id, expires_at, used_at FROM customer_password_reset WHERE token = ${token} LIMIT 1
    `;

    if (rows.length === 0 || rows[0].used_at !== null || rows[0].expires_at < new Date()) {
      throw new BadRequestException({ code: 'INVALID_RESET_TOKEN' });
    }

    return { valid: true };
  }

  async resetPassword(dto: ResetPasswordDto, tenantId: string): Promise<{ message: string }> {
    const db = this.db(tenantId);

    const rows = await db.$queryRaw<PasswordResetRow[]>`
      SELECT id, customer_id, expires_at, used_at FROM customer_password_reset
      WHERE token = ${dto.token} LIMIT 1
    `;

    if (rows.length === 0) {
      throw new BadRequestException({ code: 'INVALID_RESET_TOKEN' });
    }

    const reset = rows[0];

    if (reset.used_at !== null) {
      throw new BadRequestException({ code: 'TOKEN_ALREADY_USED' });
    }
    if (reset.expires_at < new Date()) {
      throw new BadRequestException({ code: 'TOKEN_EXPIRED' });
    }

    const passwordHash = await hash(dto.newPassword, BCRYPT_ROUNDS);
    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE customer SET password_hash = ${passwordHash}, updated_at = ${now}
        WHERE id = ${reset.customer_id}
      `;
      await tx.$executeRaw`
        UPDATE customer_password_reset SET used_at = ${now} WHERE id = ${reset.id}
      `;
      await tx.$executeRaw`
        UPDATE customer_refresh_token SET revoked_at = ${now}
        WHERE customer_id = ${reset.customer_id} AND revoked_at IS NULL
      `;
    });

    return { message: 'PASSWORD_RESET_SUCCESS' };
  }
}
