import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/providers/brand-provider', () => ({
  useBrand: () => ({ brand: 'homtone', setBrand: vi.fn() }),
}));

describe('AdminShell', () => {
  it('exports AdminShell, AdminSidebar, AdminTopbar', async () => {
    const shell = await import('./admin-shell');
    const sidebar = await import('./admin-sidebar');
    const topbar = await import('./admin-topbar');

    expect(shell.AdminShell).toBeDefined();
    expect(sidebar.AdminSidebar).toBeDefined();
    expect(topbar.AdminTopbar).toBeDefined();
  });
});
