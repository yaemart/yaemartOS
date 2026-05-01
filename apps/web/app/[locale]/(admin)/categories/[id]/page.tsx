import Link from 'next/link';
import { getCategory } from '@/lib/api/catalog-client';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function CategoryDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  const category = await getCategory(guard.accessToken, params.id, guard.user.brandId);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/${params.locale}/categories`}
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← 返回品类库
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{category.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          slug: {category.slug} · 菜谱: {category.requiresRecipe ? '需要' : '不需要'}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <p className="text-sm text-zinc-600">
          品类详情页在当前切片提供基础信息，模板编辑请进入独立页面。
        </p>
        <Link
          href={`/${params.locale}/categories/${params.id}/template`}
          className="mt-4 inline-block text-sm font-medium text-[rgb(var(--brand-primary))] hover:underline"
        >
          前往模板编辑 →
        </Link>
      </div>
    </div>
  );
}
