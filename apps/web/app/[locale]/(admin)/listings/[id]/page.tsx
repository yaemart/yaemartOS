import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/route-guard';
import { ListingEditorShell } from '@/components/listing/listing-editor-shell';
import { ListingMatrixDashboard } from '@/components/listing/listing-matrix-dashboard';
import { fetchCapabilities } from '@/lib/api/auth-client';
import { getListing } from '@/lib/api/listing-client';

type Tab = 'editor' | 'matrix';

export default async function AdminListingEditorPage({
  params,
  searchParams,
}: {
  params: { locale: string; id: string };
  searchParams?: { tab?: string };
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    redirect(`/${params.locale}/login`);
  }

  const [listing, capabilities] = await Promise.all([
    getListing(guard.accessToken, params.id, guard.user.brandId).catch(() => null),
    fetchCapabilities(guard.accessToken, guard.user.brandId).catch(() => [] as string[]),
  ]);

  if (!listing) {
    redirect(`/${params.locale}/listings`);
  }

  const matrixEnabled = capabilities.includes('LISTING_MATRIX');
  const activeTab: Tab =
    searchParams?.tab === 'matrix' && listing.productId && matrixEnabled ? 'matrix' : 'editor';

  const tabBase = `/${params.locale}/listings/${params.id}`;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white px-6">
        <nav className="-mb-px flex gap-6">
          <Link
            href={tabBase}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'editor'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            编辑器
          </Link>
          {matrixEnabled && listing.productId && (
            <Link
              href={`${tabBase}?tab=matrix`}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'matrix'
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700'
              }`}
            >
              矩阵分析
            </Link>
          )}
        </nav>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'matrix' && listing.productId && matrixEnabled ? (
          <ListingMatrixDashboard
            productId={listing.productId}
            accessToken={guard.accessToken}
            brandId={guard.user.brandId}
          />
        ) : (
          <ListingEditorShell
            listing={listing}
            locale={params.locale}
            accessToken={guard.accessToken}
            brandId={guard.user.brandId}
          />
        )}
      </div>
    </div>
  );
}
