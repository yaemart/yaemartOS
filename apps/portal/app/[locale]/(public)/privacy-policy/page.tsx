import Link from 'next/link';
import { BrandHeader } from '@/components/brand-header';
import { getPrivacyPolicy } from '@/lib/api/customer-api-client';

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
];

export default async function PrivacyPolicyPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  let content = '';
  try {
    const result = await getPrivacyPolicy(locale);
    content = result.content ?? '';
  } catch {
    content = '';
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <BrandHeader locale={locale} />

      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand-text">隐私政策</h1>

          {/* Locale switcher */}
          <div className="mt-3 flex gap-2">
            {LOCALES.map((l) => (
              <Link
                key={l.code}
                href={`/${l.code}/privacy-policy`}
                className={[
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  locale === l.code
                    ? 'border-[rgb(var(--brand-primary))] bg-[rgb(var(--brand-primary))]/10 text-[rgb(var(--brand-primary))]'
                    : 'border-zinc-200 bg-brand-surface text-brand-text-secondary hover:bg-zinc-50',
                ].join(' ')}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="rounded-lg border border-zinc-200 bg-brand-surface p-6 shadow-xs">
          {content ? (
            <div
              className="prose prose-sm max-w-none text-brand-text [&_h1]:text-brand-text [&_h2]:text-brand-text [&_h3]:text-brand-text [&_a]:text-[rgb(var(--brand-primary))] [&_a:hover]:underline"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="mb-4 h-10 w-10 text-brand-text-secondary/30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-sm font-medium text-brand-text">隐私政策内容即将更新</p>
              <p className="mt-1 text-xs text-brand-text-secondary">请稍后再来查看。</p>
            </div>
          )}
        </div>

        {/* Back link */}
        <div className="mt-6">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            返回首页
          </Link>
        </div>
      </main>
    </div>
  );
}
