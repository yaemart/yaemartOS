import Link from 'next/link';
import type { ProductItem } from '@/lib/api/catalog-client';
import { SourceBadge } from './source-badge';

export function ProductList({ locale, products }: { locale: string; products: ProductItem[] }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-20 text-center">
        <p className="text-base font-medium text-zinc-600">还没有产品</p>
        <p className="mt-1 text-sm text-zinc-400">创建第一个产品，开始管理商品内容</p>
        <Link
          href={`/${locale}/products/new`}
          className="mt-6 rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white"
        >
          + 新建产品
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3">产品名称</th>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3">品牌</th>
            <th className="px-4 py-3">品类</th>
            <th className="px-4 py-3">来源</th>
            <th className="px-4 py-3">Listing</th>
            <th className="px-4 py-3">操作</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="h-16 border-t border-zinc-100 hover:bg-zinc-50">
              <td className="px-4 py-3 font-medium text-zinc-900">{product.title}</td>
              <td className="px-4 py-3 text-zinc-600">{product.sku}</td>
              <td className="px-4 py-3 text-zinc-600">{product.brandId}</td>
              <td className="px-4 py-3 text-zinc-600">{product.category?.name ?? '-'}</td>
              <td className="px-4 py-3">
                <SourceBadge source={product.contents?.[0]?.source ?? 'manual'} />
              </td>
              <td className="px-4 py-3 text-zinc-600">{product._count?.listings ?? 0}</td>
              <td className="px-4 py-3">
                <Link
                  href={`/${locale}/products/${product.id}`}
                  className="text-sm text-[rgb(var(--brand-primary))] hover:underline"
                >
                  查看
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
