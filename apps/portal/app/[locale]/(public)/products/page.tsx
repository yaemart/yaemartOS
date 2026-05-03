import Link from 'next/link';
import { BrandHeader } from '@/components/brand-header';
import { ProductCard } from '@/components/product-card';
import { getProducts } from '@/lib/api/customer-api-client';

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
];

const PAGE_SIZE = 12;

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { page?: string };
}) {
  const { locale } = params;
  const page = searchParams?.page ? Math.max(1, Number(searchParams.page)) : 1;

  let data;
  try {
    data = await getProducts({ locale, page, limit: PAGE_SIZE });
  } catch {
    data = { data: [], total: 0, page: 1, limit: PAGE_SIZE };
  }

  const totalPages = Math.ceil(data.total / data.limit);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  function buildHref(p: number) {
    const qs = p > 1 ? `?page=${p}` : '';
    return `/${locale}/products${qs}`;
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <BrandHeader locale={locale} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand-text">产品目录</h1>
          {data.total > 0 && (
            <p className="mt-1 text-sm text-brand-text-secondary">共 {data.total} 款产品</p>
          )}
        </div>

        {/* Locale switcher */}
        <div className="mb-6 flex gap-2">
          {LOCALES.map((l) => (
            <Link
              key={l.code}
              href={`/${l.code}/products`}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                locale === l.code
                  ? 'border-[rgb(var(--brand-primary))] bg-[rgb(var(--brand-primary))]/10 text-[rgb(var(--brand-primary))]'
                  : 'border-zinc-200 bg-brand-surface text-brand-text-secondary hover:bg-zinc-50',
              ].join(' ')}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Product grid */}
        {data.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-20 text-center">
            <svg
              className="mb-4 h-12 w-12 text-brand-text-secondary/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <p className="text-sm text-brand-text-secondary">暂无产品</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                sku={product.sku}
                title={product.title}
                description={product.description}
                imageUrls={product.imageUrls}
                slug={product.slug}
                locale={locale}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between text-sm text-brand-text-secondary">
            <span>
              第 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} 条，共{' '}
              {data.total} 条
            </span>
            <div className="flex gap-2">
              {hasPrev && (
                <Link
                  href={buildHref(page - 1)}
                  className="rounded-md border border-zinc-200 bg-brand-surface px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 transition-colors"
                >
                  上一页
                </Link>
              )}
              {hasNext && (
                <Link
                  href={buildHref(page + 1)}
                  className="rounded-md border border-zinc-200 bg-brand-surface px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 transition-colors"
                >
                  下一页
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
