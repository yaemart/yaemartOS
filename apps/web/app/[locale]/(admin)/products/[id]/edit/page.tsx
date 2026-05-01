import { ProductForm } from '@/components/product/product-form';
import { getProduct, listCategories } from '@/lib/api/catalog-client';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function EditProductPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  const [product, categories] = await Promise.all([
    getProduct(guard.accessToken, params.id, guard.user.brandId),
    listCategories(
      guard.accessToken,
      { page: 1, pageSize: 200, brandId: guard.user.brandId },
      guard.user.brandId,
    ),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">编辑产品</h1>
        <p className="mt-0.5 text-sm text-zinc-500">更新基础信息与 FAQ 手工内容</p>
      </div>
      <ProductForm
        locale={params.locale}
        accessToken={guard.accessToken}
        brandId={guard.user.brandId}
        categories={categories.data}
        mode="edit"
        productId={params.id}
        defaultValue={{
          title: product.title,
          sku: product.sku,
          categoryId: product.categoryId,
          description: product.description,
        }}
      />
    </div>
  );
}
