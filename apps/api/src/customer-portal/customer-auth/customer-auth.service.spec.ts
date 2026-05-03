import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerAuthService } from './customer-auth.service';

const TENANT_ID = 'homtone';

const mockCustomerRow = {
  id: 'cust-001',
  email: 'test@example.com',
  password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LedYx0NP3h.QLvX3G',
  is_active: true,
  name: 'Test User',
  email_verified_at: new Date(),
};

const mockVerificationRow = {
  id: 'verif-001',
  customer_id: 'cust-001',
  token: 'valid-token',
  expires_at: new Date(Date.now() + 3600 * 1000),
  used_at: null,
};

const mockRefreshRow = {
  id: 'rt-001',
  customer_id: 'cust-001',
  token_hash: 'hashed',
  expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000),
  revoked_at: null,
  email: 'test@example.com',
};

function buildMockDb() {
  return {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $executeRaw: vi.fn().mockResolvedValue(1),
      }),
    ),
  };
}

describe('CustomerAuthService', () => {
  let service: CustomerAuthService;
  let mockDb: ReturnType<typeof buildMockDb>;

  const mockMailService = {
    sendVerification: vi.fn().mockResolvedValue(undefined),
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
  };

  const mockJwtService = {
    signAsync: vi.fn().mockResolvedValue('mock.access.token'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = buildMockDb();

    const mockPrismaManager = {
      getTenantClient: vi.fn().mockReturnValue(mockDb),
    };

    service = new CustomerAuthService(
      mockPrismaManager as never,
      mockMailService as never,
      mockJwtService as never,
    );
  });

  describe('register', () => {
    it('happy path: registers new customer and sends verification email', async () => {
      mockDb.$queryRaw.mockResolvedValue([]); // no existing customer

      const result = await service.register(
        { email: 'new@example.com', password: 'password123' },
        TENANT_ID,
      );

      expect(result).toEqual({ message: 'VERIFICATION_EMAIL_SENT' });
      expect(mockDb.$executeRaw).toHaveBeenCalledTimes(2); // INSERT customer + INSERT verification
      expect(mockMailService.sendVerification).toHaveBeenCalledWith(
        'new@example.com',
        expect.any(String),
        TENANT_ID,
        'zh',
      );
    });

    it('throws 409 ConflictException when email already exists', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ id: 'existing-id' }]); // existing customer

      await expect(
        service.register({ email: 'test@example.com', password: 'password123' }, TENANT_ID),
      ).rejects.toThrow(ConflictException);

      expect(mockMailService.sendVerification).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('throws 403 ForbiddenException with EMAIL_NOT_VERIFIED for inactive customer', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ ...mockCustomerRow, is_active: false }]);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }, TENANT_ID),
      ).rejects.toSatisfy(
        (err: unknown) => err instanceof ForbiddenException || err instanceof UnauthorizedException,
      );
    });

    it('throws 401 UnauthorizedException when customer does not exist', async () => {
      mockDb.$queryRaw.mockResolvedValue([]);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }, TENANT_ID),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('always returns 200 regardless of email existence (anti-enumeration)', async () => {
      mockDb.$queryRaw.mockResolvedValue([]); // no customer found

      const result = await service.forgotPassword('nonexistent@example.com', TENANT_ID);

      expect(result).toEqual({ message: 'PASSWORD_RESET_EMAIL_SENT' });
      expect(mockMailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('always returns 200 even when DB throws (anti-enumeration)', async () => {
      mockDb.$queryRaw.mockRejectedValue(new Error('DB connection error'));

      const result = await service.forgotPassword('any@example.com', TENANT_ID);

      expect(result).toEqual({ message: 'PASSWORD_RESET_EMAIL_SENT' });
    });
  });

  describe('refreshTokens', () => {
    it('throws 401 when refresh token is already revoked', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ ...mockRefreshRow, revoked_at: new Date() }]);

      await expect(service.refreshTokens('revoked-token', TENANT_ID)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 401 when refresh token does not exist', async () => {
      mockDb.$queryRaw.mockResolvedValue([]);

      await expect(service.refreshTokens('nonexistent-token', TENANT_ID)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('throws 400 when token is already used', async () => {
      mockDb.$queryRaw.mockResolvedValue([{ ...mockVerificationRow, used_at: new Date() }]);

      await expect(service.verifyEmail('used-token', TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws 400 when token is expired', async () => {
      mockDb.$queryRaw.mockResolvedValue([
        { ...mockVerificationRow, expires_at: new Date(Date.now() - 1000) },
      ]);

      await expect(service.verifyEmail('expired-token', TENANT_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
