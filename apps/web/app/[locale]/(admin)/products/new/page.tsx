import { ProductForm } from '@/components/product/product-form';
import { listCategories } from '@/lib/api/catalog-client';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function NewProductPage({ params }: { params: { locale: string } }) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  const categories = await listCategories(
    guard.accessToken,
    { page: 1, pageSize: 200, brandId: guard.user.brandId },
    guard.user.brandId,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">新建产品</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          选定品类后可自动继承模板，覆盖编辑会记录为 manual 来源。
        </p>
      </div>
      <ProductForm
        locale={params.locale}
        accessToken={guard.accessToken}
        brandId={guard.user.brandId}
        categories={categories.data}
        mode="create"
      />
    </div>
  );
}
