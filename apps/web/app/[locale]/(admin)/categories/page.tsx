import Link from 'next/link';
import { CategoryList } from '@/components/category/category-list';
import { listCategories } from '@/lib/api/catalog-client';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function CategoriesPage({
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
  const data = await listCategories(
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
          <h1 className="text-xl font-semibold text-zinc-900">品类库</h1>
          <p className="mt-0.5 text-sm text-zinc-500">共 {data.total} 个品类</p>
        </div>
        <Link
          href={`/${params.locale}/categories/new`}
          className="rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white"
        >
          + 新建品类
        </Link>
      </div>
      <CategoryList locale={params.locale} categories={data.data} />
    </div>
  );
}
