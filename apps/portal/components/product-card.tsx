import Link from 'next/link';
import Image from 'next/image';

interface ProductCardProps {
  id: string;
  sku?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  slug: string;
  locale: string;
  price?: number;
  currency?: string;
}

function truncate(text: string, max: number) {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max).trimEnd() + '…';
}

export function ProductCard({
  sku,
  name,
  description,
  imageUrl,
  slug,
  locale,
  price,
  currency,
}: ProductCardProps) {
  return (
    <Link
      href={`/${locale}/products/${slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-brand-surface transition-shadow hover:shadow-md"
    >
      {/* Image / placeholder */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-primary/10">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              className="h-12 w-12 text-brand-primary/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="text-sm font-semibold leading-snug text-brand-text group-hover:text-brand-primary transition-colors line-clamp-2">
          {name}
        </h3>
        {sku && <p className="text-xs text-brand-text-secondary font-mono">SKU: {sku}</p>}
        {description && (
          <p className="text-xs text-brand-text-secondary leading-relaxed">
            {truncate(description, 100)}
          </p>
        )}
        {price != null && (
          <p className="mt-auto pt-2 text-sm font-semibold text-brand-primary">
            {currency ?? 'USD'} {price.toFixed(2)}
          </p>
        )}
      </div>
    </Link>
  );
}
