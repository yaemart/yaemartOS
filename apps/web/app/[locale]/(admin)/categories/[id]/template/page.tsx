import Link from 'next/link';
import { TemplateEditor } from '@/components/category/template-editor';
import { getCategory, getCategoryTemplate } from '@/lib/api/catalog-client';
import { requireAuth } from '@/lib/auth/route-guard';

export default async function CategoryTemplatePage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  const guard = await requireAuth(params.locale);
  if (guard.status !== 'authenticated') {
    return null;
  }

  const [category, template] = await Promise.all([
    getCategory(guard.accessToken, params.id, guard.user.brandId),
    getCategoryTemplate(guard.accessToken, params.id, 'en', guard.user.brandId),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/${params.locale}/categories/${params.id}`}
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← 返回品类详情
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900">{category.name} · 内容模板</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          配置规格参数、FAQ 与菜谱模板，供产品创建时继承。
        </p>
      </div>

      <TemplateEditor
        locale={params.locale}
        categoryId={params.id}
        brandId={guard.user.brandId}
        accessToken={guard.accessToken}
        initialTemplate={template}
      />
    </div>
  );
}
