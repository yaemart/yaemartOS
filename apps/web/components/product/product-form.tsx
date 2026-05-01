'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  type CategoryItem,
  createProduct,
  updateProduct,
  updateProductContent,
} from '@/lib/api/catalog-client';

export function ProductForm({
  locale,
  accessToken,
  brandId,
  categories,
  mode,
  productId,
  defaultValue,
}: {
  locale: string;
  accessToken: string;
  brandId: string;
  categories: CategoryItem[];
  mode: 'create' | 'edit';
  productId?: string;
  defaultValue?: {
    title: string;
    sku: string;
    categoryId: string;
    description?: string | null;
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultValue?.title ?? '');
  const [sku, setSku] = useState(defaultValue?.sku ?? '');
  const [categoryId, setCategoryId] = useState(defaultValue?.categoryId ?? categories[0]?.id ?? '');
  const [description, setDescription] = useState(defaultValue?.description ?? '');
  const [faqJson, setFaqJson] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'create') {
        const created = await createProduct(
          accessToken,
          {
            brandId,
            categoryId,
            sku,
            title,
            description: description || undefined,
            locale: 'en',
          },
          brandId,
        );

        if (faqJson.trim()) {
          await updateProductContent(
            accessToken,
            created.id,
            {
              locale: 'en',
              payload: { faq: JSON.parse(faqJson) },
            },
            brandId,
          );
        }

        router.push(`/${locale}/products/${created.id}`);
      } else if (productId) {
        await updateProduct(
          accessToken,
          productId,
          {
            categoryId,
            sku,
            title,
            description: description || null,
          },
          brandId,
        );

        if (faqJson.trim()) {
          await updateProductContent(
            accessToken,
            productId,
            {
              locale: 'en',
              payload: { faq: JSON.parse(faqJson) },
            },
            brandId,
          );
        }

        router.push(`/${locale}/products/${productId}`);
      }
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '保存产品失败';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-700">产品名称 *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="h-9 w-full rounded-lg border border-zinc-200 px-3"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">SKU *</label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            required
            className="h-9 w-full rounded-lg border border-zinc-200 px-3"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">品类 *</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className="h-9 w-full rounded-lg border border-zinc-200 px-3"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-700">描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[100px] w-full rounded-lg border border-zinc-200 px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-700">FAQ（JSON，可选）</label>
        <textarea
          value={faqJson}
          onChange={(e) => setFaqJson(e.target.value)}
          className="min-h-[100px] w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs"
          placeholder='[{"q":"问题","a":"答案"}]'
        />
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? '保存中...' : mode === 'create' ? '保存并查看' : '保存修改'}
        </button>
      </div>
    </form>
  );
}
