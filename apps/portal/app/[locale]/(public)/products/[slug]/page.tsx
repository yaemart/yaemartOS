import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { BrandHeader } from '@/components/brand-header';
import { ProductFaq } from '@/components/product-faq';
import { getProduct } from '@/lib/api/customer-api-client';

export const revalidate = 3600;

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
];

export default async function ProductDetailPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  let product;
  try {
    product = await getProduct(slug, locale);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) {
      notFound();
    }
    notFound();
  }

  const mainImage = product.imageUrl ?? product.images?.[0];

  return (
    <div className="min-h-screen bg-brand-bg">
      <BrandHeader locale={locale} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Back link */}
        <Link
          href={`/${locale}/products`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-brand-text-secondary hover:text-brand-text transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          返回商品列表
        </Link>

        <div className="lg:grid lg:grid-cols-2 lg:gap-10">
          {/* Product image */}
          <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-brand-primary/10">
            {mainImage ? (
              <Image
                src={mainImage}
                alt={product.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <svg
                  className="h-20 w-20 text-brand-primary/20"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="mt-6 lg:mt-0">
            {/* Locale switcher */}
            <div className="mb-4 flex gap-2">
              {LOCALES.map((l) => (
                <Link
                  key={l.code}
                  href={`/${l.code}/products/${slug}`}
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

            <h1 className="text-2xl font-bold leading-snug text-brand-text">{product.name}</h1>

            {product.sku && (
              <p className="mt-2 font-mono text-xs text-brand-text-secondary">SKU: {product.sku}</p>
            )}

            <p className="mt-3 text-xl font-semibold text-brand-primary">
              {product.currency ?? 'USD'} {product.price.toFixed(2)}
            </p>

            {product.description && (
              <div className="mt-4">
                <h2 className="mb-2 text-sm font-semibold text-brand-text">产品描述</h2>
                <p className="text-sm leading-relaxed text-brand-text-secondary whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* Extra images */}
            {product.images && product.images.length > 1 && (
              <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, i) => (
                  <div
                    key={i}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-zinc-200"
                  >
                    <Image
                      src={img}
                      alt={`${product.name} ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FAQ */}
        <ProductFaq faq={product.faq} />
      </main>
    </div>
  );
}
