import Link from 'next/link';
import { ProductList } from '@/components/product/product-list';
import { listProducts } from '@/lib/api/catalog-client';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { page?: string; search?: string };
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  const page = searchParams?.page ? Number(searchParams.page) : 1;
  const data = await listProducts(
    guard.accessToken,
    {
      page,
      pageSize: 20,
      brandId: guard.user.brandId,
      search: searchParams?.search,
    },
    guard.user.brandId,
  );

  return (
    <div>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">产品管理</h1>
          <p className="mt-0.5 text-sm text-zinc-500">共 {data.total} 个产品</p>
        </div>
        <Link
          href={`/${params.locale}/products/new`}
          className="rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white"
        >
          + 新建产品
        </Link>
      </div>
      <ProductList locale={params.locale} products={data.data} />
    </div>
  );
}
