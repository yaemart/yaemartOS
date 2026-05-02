import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../generated/prisma';
import { AuditService } from '../common/audit/audit.service';
import { PrismaClientManager } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { hash } from 'bcrypt';

function createService() {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    brand: { findUnique: vi.fn() },
    invitation: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    authAccount: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    refreshToken: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  };

  const prismaManager = {
    getPublicClient: () => prisma,
  } as unknown as PrismaClientManager;

  const jwtService = {
    signAsync: vi.fn().mockResolvedValue('access-token'),
  } as unknown as JwtService;

  const configService = new ConfigService({
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: '15m',
  });

  const auditService = {
    logWrite: vi.fn(),
  } as unknown as AuditService;

  const service = new AuthService(prismaManager, jwtService, configService, auditService);
  return { service, prisma, auditService };
}

describe('AuthService', () => {
  it('validates local user with password hash', async () => {
    const { service, prisma } = createService();
    const passwordHash = await hash('password123', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash,
      brandId: 'homtone',
      role: UserRole.operator,
    });

    await expect(service.validateLocalUser('user@example.com', 'password123')).resolves.toEqual({
      id: 'u1',
      email: 'user@example.com',
      brandId: 'homtone',
      role: UserRole.operator,
    });
  });

  it('creates invitation and writes audit log', async () => {
    const { service, prisma, auditService } = createService();
    prisma.brand.findUnique.mockResolvedValue({ id: 'homtone' });
    prisma.invitation.create.mockResolvedValue({
      id: 'inv-1',
      email: 'invitee@example.com',
      role: UserRole.operator,
    });

    await service.createInvitation({
      email: 'invitee@example.com',
      brandId: 'homtone',
      role: UserRole.operator,
      createdById: 'admin-1',
    });

    expect(prisma.invitation.create).toHaveBeenCalled();
    expect(auditService.logWrite).toHaveBeenCalled();
  });
});
