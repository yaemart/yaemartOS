'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type CategoryTemplate, upsertCategoryTemplate } from '@/lib/api/catalog-client';

function pretty(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return JSON.stringify(value, null, 2);
}

export function TemplateEditor({
  locale,
  categoryId,
  brandId,
  accessToken,
  initialTemplate,
}: {
  locale: string;
  categoryId: string;
  brandId: string;
  accessToken: string;
  initialTemplate: CategoryTemplate | null;
}) {
  const router = useRouter();
  const initialLocale = initialTemplate?.locale ?? 'en';
  const [templateLocale, setTemplateLocale] = useState(initialLocale);
  const [specParams, setSpecParams] = useState(pretty(initialTemplate?.specParams));
  const [featureWords, setFeatureWords] = useState(pretty(initialTemplate?.featureWords));
  const [sellingPoints, setSellingPoints] = useState(pretty(initialTemplate?.sellingPoints));
  const [faqTemplate, setFaqTemplate] = useState(pretty(initialTemplate?.faqTemplate));
  const [recipeTemplate, setRecipeTemplate] = useState(pretty(initialTemplate?.recipeTemplate));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        locale: templateLocale,
        specParams: specParams ? JSON.parse(specParams) : [],
        featureWords: featureWords ? JSON.parse(featureWords) : [],
        sellingPoints: sellingPoints ? JSON.parse(sellingPoints) : [],
        faqTemplate: faqTemplate ? JSON.parse(faqTemplate) : [],
        recipeTemplate: recipeTemplate ? JSON.parse(recipeTemplate) : [],
      };
      await upsertCategoryTemplate(accessToken, categoryId, payload, brandId);
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '保存模板失败';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700">语言</label>
          <select
            value={templateLocale}
            onChange={(e) => setTemplateLocale(e.target.value as 'en' | 'es' | 'fr' | 'de' | 'it')}
            className="h-9 w-full rounded-lg border border-zinc-200 px-3"
          >
            <option value="en">en</option>
            <option value="es">es</option>
            <option value="fr">fr</option>
            <option value="de">de</option>
            <option value="it">it</option>
          </select>
        </div>
      </div>

      <TextareaBlock label="规格参数定义（JSON）" value={specParams} onChange={setSpecParams} />
      <TextareaBlock label="功能词库（JSON）" value={featureWords} onChange={setFeatureWords} />
      <TextareaBlock label="卖点库（JSON）" value={sellingPoints} onChange={setSellingPoints} />
      <TextareaBlock label="FAQ 模板（JSON）" value={faqTemplate} onChange={setFaqTemplate} />
      <TextareaBlock label="菜谱模板（JSON）" value={recipeTemplate} onChange={setRecipeTemplate} />

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[rgb(var(--brand-primary))] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitting ? '保存中...' : '保存模板'}
        </button>
      </div>
    </form>
  );
}

function TextareaBlock({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[120px] w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs"
      />
    </div>
  );
}
