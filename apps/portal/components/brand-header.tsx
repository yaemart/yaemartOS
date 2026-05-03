import Link from 'next/link';

const BRAND = process.env.NEXT_PUBLIC_BRAND ?? 'homtone';

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
];

interface Props {
  locale: string;
}

export function BrandHeader({ locale }: Props) {
  return (
    <header className="sticky top-0 z-sticky border-b bg-brand-surface px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href={`/${locale}`} className="text-base font-bold text-brand-text">
          {capitalize(BRAND)}
        </Link>

        <nav className="flex items-center gap-2">
          {LOCALES.map((l) => (
            <Link
              key={l.code}
              href={`/${l.code}`}
              className={`rounded px-2 py-1 text-xs font-medium ${
                locale === l.code
                  ? 'bg-brand-primary text-white'
                  : 'text-brand-text-secondary hover:text-brand-text'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
