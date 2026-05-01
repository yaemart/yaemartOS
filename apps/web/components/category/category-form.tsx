'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createCategory } from '@/lib/api/catalog-client';

export function CategoryForm({
  locale,
  accessToken,
  defaultBrandId,
}: {
  locale: string;
  accessToken: string;
  defaultBrandId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [requiresRecipe, setRequiresRecipe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await createCategory(
        accessToken,
        {
          brandId: defaultBrandId,
          name,
          slug,
          requiresRecipe,
          isActive: true,
        },
        defaultBrandId,
      );
      router.push(`/${locale}/categories`);
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '创建品类失败';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-2xl space-y-6 rounded-xl border border-zinc-200 bg-white p-6"
    >
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-700">品类名称 *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="h-9 w-full rounded-lg border border-zinc-200 px-3"
          placeholder="例如：厨电·慢炖锅"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Slug *</label>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="h-9 w-full rounded-lg border border-zinc-200 px-3"
          placeholder="slow-cooker"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={requiresRecipe}
          onChange={(e) => setRequiresRecipe(e.target.checked)}
        />
        此品类需要菜谱模板
      </label>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/categories`)}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? '保存中...' : '保存品类'}
        </button>
      </div>
    </form>
  );
}
