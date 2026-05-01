import Link from 'next/link';
import { ProductDetailTabs } from '@/components/product/product-detail-tabs';
import { getProduct } from '@/lib/api/catalog-client';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function ProductDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  const product = await getProduct(guard.accessToken, params.id, guard.user.brandId);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/${params.locale}/products`}
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← 返回产品管理
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">{product.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {product.sku} · {product.brandId} · {product.category?.name ?? '-'}
            </p>
          </div>
          <Link
            href={`/${params.locale}/products/${params.id}/edit`}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
          >
            编辑
          </Link>
        </div>
      </div>
      <ProductDetailTabs product={product} />
    </div>
  );
}
