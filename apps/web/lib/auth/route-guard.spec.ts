import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('./session', () => ({
  getSession: vi.fn(),
}));

vi.mock('../api/auth-client', () => ({
  fetchMe: vi.fn(),
}));

import { requireAuth } from './route-guard';
import { getSession } from './session';
import { fetchMe } from '../api/auth-client';

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to login when no session', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    await expect(requireAuth('en')).rejects.toThrow('REDIRECT:/en/login');
  });

  it('returns authenticated result when session is valid', async () => {
    vi.mocked(getSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
    });
    vi.mocked(fetchMe).mockResolvedValue({
      id: '1',
      email: 'a@b.com',
      brandId: 'homtone',
      role: 'admin',
    });
    const result = await requireAuth('en');
    expect(result).toEqual({
      status: 'authenticated',
      user: { id: '1', email: 'a@b.com', brandId: 'homtone', role: 'admin' },
      accessToken: 'tok',
    });
  });

  it('redirects to login when fetchMe fails', async () => {
    vi.mocked(getSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
    });
    vi.mocked(fetchMe).mockRejectedValue(new Error('401'));
    await expect(requireAuth('en')).rejects.toThrow('REDIRECT:/en/login');
  });
});
