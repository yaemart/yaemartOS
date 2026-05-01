import { CategoryForm } from '@/components/category/category-form';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function NewCategoryPage({ params }: { params: { locale: string } }) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">新建品类</h1>
        <p className="mt-0.5 text-sm text-zinc-500">创建品类并配置模板继承基础</p>
      </div>
      <CategoryForm
        locale={params.locale}
        accessToken={guard.accessToken}
        defaultBrandId={guard.user.brandId}
      />
    </div>
  );
}
