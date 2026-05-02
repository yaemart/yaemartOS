import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, InvitationStatus, UserRole, type User } from '../generated/prisma';
import { AuditService } from '../common/audit/audit.service';
import { PrismaClientManager } from '../database/prisma.service';
import { AuthUser, OauthProfile, TokenPair } from './auth.types';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

const REFRESH_TOKEN_DAYS = 14;

@Injectable()
export class AuthService {
  constructor(
    private readonly prismaManager: PrismaClientManager,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  private get prisma() {
    return this.prismaManager.getPublicClient();
  }

  async validateLocalUser(email: string, password: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      return null;
    }
    const isValid = await compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }
    return this.toAuthUser(user);
  }

  async loginWithUser(user: AuthUser): Promise<TokenPair> {
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(refreshToken);
    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
      include: { user: true },
    });

    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(this.toAuthUser(existing.user));
  }

  async oauthLogin(profile: OauthProfile): Promise<TokenPair> {
    let account = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (!account) {
      const email = profile.email;
      if (!email) {
        throw new BadRequestException('OAuth profile does not contain email');
      }

      const user = await this.prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          brandId: 'homtone',
          role: UserRole.operator,
        },
      });

      account = await this.prisma.authAccount.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
        include: { user: true },
      });
    }

    return this.issueTokens(this.toAuthUser(account.user));
  }

  async createInvitation(input: {
    email: string;
    brandId: string;
    role: UserRole;
    createdById?: string;
  }) {
    const brand = await this.prisma.brand.findUnique({ where: { id: input.brandId } });
    if (!brand) {
      throw new NotFoundException(`brand not found: ${input.brandId}`);
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 3 * 24 * 3600 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        email: input.email,
        brandId: input.brandId,
        role: input.role,
        token,
        expiresAt,
        createdById: input.createdById,
      },
    });

    await this.auditService.logWrite({
      userId: input.createdById,
      tenant: input.brandId,
      action: 'invite.create',
      entity: 'Invitation',
      entityId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role },
    });

    return invitation;
  }

  async acceptInvitation(token: string, password: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invitation || invitation.status !== InvitationStatus.pending) {
      throw new BadRequestException('Invitation is invalid');
    }
    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.expired },
      });
      throw new BadRequestException('Invitation expired');
    }

    const passwordHash = await hash(password, 10);
    const user = await this.prisma.user.upsert({
      where: { email: invitation.email },
      update: {
        passwordHash,
        brandId: invitation.brandId,
        role: invitation.role,
      },
      create: {
        email: invitation.email,
        passwordHash,
        brandId: invitation.brandId,
        role: invitation.role,
      },
    });

    await this.prisma.authAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.email,
          providerAccountId: user.email,
        },
      },
      update: { userId: user.id },
      create: {
        userId: user.id,
        provider: AuthProvider.email,
        providerAccountId: user.email,
      },
    });

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.accepted, acceptedAt: new Date() },
    });

    await this.auditService.logWrite({
      userId: user.id,
      tenant: user.brandId,
      action: 'invite.accept',
      entity: 'Invitation',
      entityId: invitation.id,
      metadata: { email: user.email },
    });

    return this.issueTokens(this.toAuthUser(user));
  }

  private async issueTokens(user: AuthUser): Promise<TokenPair> {
    const secret = this.configService.get<string>('JWT_SECRET') ?? 'dev-secret';
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, brandId: user.brandId, role: user.role },
      {
        secret,
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m',
      },
    );

    const refreshToken = randomBytes(32).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 3600 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      brandId: user.brandId,
      role: user.role,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
