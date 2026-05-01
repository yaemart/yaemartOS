import { AdminShell } from '@/components/admin/admin-shell';
import { fetchCapabilities } from '@/lib/api/auth-client';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function AdminLayout({
  params,
  children,
}: {
  params: { locale: string };
  children: React.ReactNode;
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }
  const capabilities = await fetchCapabilities(guard.accessToken, guard.user.brandId);

  return <AdminShell capabilities={capabilities}>{children}</AdminShell>;
}
