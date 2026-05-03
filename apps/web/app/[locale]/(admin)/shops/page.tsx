import { ShopsPageClient } from '@/components/shop/shops-page-client';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function ShopsPage({ params }: { params: { locale: string } }) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  return <ShopsPageClient accessToken={guard.accessToken} />;
}
