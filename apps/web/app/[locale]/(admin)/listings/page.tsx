import Link from 'next/link';
import { listListings } from '@/lib/api/listing-client';
import { requireAuth } from '@/lib/auth/route-guard';
import { ListingStatusBadge } from '@/components/listing/listing-status-badge';

const STATUS_FILTER_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'review', label: '审核中' },
  { value: 'approved', label: '已通过' },
  { value: 'published', label: '已发布' },
  { value: 'paused', label: '已暂停' },
  { value: 'archived', label: '已归档' },
];

export default async function ListingsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { page?: string; status?: string };
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  const page = searchParams?.page ? Number(searchParams.page) : 1;
  const status = searchParams?.status ?? '';

  const data = await listListings(
    guard.accessToken,
    {
      page,
      pageSize: 20,
      brandId: guard.user.brandId,
      status: status || undefined,
    },
    guard.user.brandId,
  );

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Listing 管理</h1>
          <p className="mt-0.5 text-sm text-zinc-500">共 {data.total} 条 Listing</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/${params.locale}/listings${opt.value ? `?status=${opt.value}` : ''}`}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              status === opt.value
                ? 'bg-[rgb(var(--brand-primary))] text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
            ].join(' ')}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {/* Listing table */}
      {data.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-16 text-center">
          <p className="text-sm text-zinc-500">暂无 Listing 数据</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  产品 / ASIN
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  语言
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  主 Listing
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  版本数
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  更新时间
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 bg-white">
              {data.data.map((listing) => (
                <tr key={listing.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-zinc-900">
                      {listing.product?.title ?? listing.productId}
                    </div>
                    <div className="text-xs text-zinc-500">{listing.platformListingId}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-700">
                    {listing.language.toUpperCase()}
                  </td>
                  <td className="px-4 py-3">
                    <ListingStatusBadge status={listing.status} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {listing.isPrimary ? (
                      <span className="text-amber-600 font-medium">★ 主</span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {listing._count?.versions ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(listing.updatedAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/${params.locale}/listings/${listing.id}`}
                      className="text-xs font-medium text-[rgb(var(--brand-primary))] hover:underline"
                    >
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data.total > 20 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>
            第 {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} 条，共 {data.total} 条
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/${params.locale}/listings?page=${page - 1}${status ? `&status=${status}` : ''}`}
                className="rounded-md border px-3 py-1 hover:bg-zinc-50"
              >
                上一页
              </Link>
            )}
            {page * 20 < data.total && (
              <Link
                href={`/${params.locale}/listings?page=${page + 1}${status ? `&status=${status}` : ''}`}
                className="rounded-md border px-3 py-1 hover:bg-zinc-50"
              >
                下一页
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
