import type { AuthProvider, User } from '../../generated/prisma';

export type AuthUser = Pick<User, 'id' | 'email' | 'brandId' | 'role'>;

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export type OauthProfile = {
  provider: AuthProvider;
  providerAccountId: string;
  email?: string;
};
