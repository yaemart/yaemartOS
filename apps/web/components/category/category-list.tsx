import Link from 'next/link';
import type { CategoryItem } from '@/lib/api/catalog-client';

export function CategoryList({
  locale,
  categories,
}: {
  locale: string;
  categories: CategoryItem[];
}) {
  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-20 text-center">
        <p className="text-base font-medium text-zinc-600">还没有品类</p>
        <p className="mt-1 text-sm text-zinc-400">创建第一个品类，开始沉淀模板资产</p>
        <Link
          href={`/${locale}/categories/new`}
          className="mt-6 rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white"
        >
          + 新建品类
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">品类名称</th>
            <th className="px-4 py-3">品牌</th>
            <th className="px-4 py-3">产品数</th>
            <th className="px-4 py-3">模板</th>
            <th className="px-4 py-3">菜谱</th>
            <th className="px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id} className="border-t border-zinc-100">
              <td className="px-4 py-3 font-medium text-zinc-900">{category.name}</td>
              <td className="px-4 py-3 text-zinc-600">{category.brandId}</td>
              <td className="px-4 py-3 text-zinc-600">{category._count?.products ?? 0}</td>
              <td className="px-4 py-3 text-zinc-600">可编辑</td>
              <td className="px-4 py-3 text-zinc-600">
                {category.requiresRecipe ? '需要' : '不需要'}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/${locale}/categories/${category.id}/template`}
                  className="text-sm text-[rgb(var(--brand-primary))] hover:underline"
                >
                  编辑模板
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
