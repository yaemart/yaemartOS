'use client';

import type { LocaleInfo } from '@/lib/api/listing-client';

type Props = {
  locales: LocaleInfo[];
  activeLocale: string;
  onSwitch: (locale: string) => void;
};

/**
 * Renders a horizontal language tab bar for the listing editor.
 * Each tab shows the locale label (e.g. "EN", "ES", "FR"), with the active
 * locale highlighted using the brand primary colour.
 */
export function LocaleSwitcher({ locales, activeLocale, onSwitch }: Props) {
  if (locales.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 border-b bg-white px-6">
      {locales.map((locale) => {
        const isActive = locale.language === activeLocale;
        return (
          <button
            key={locale.language}
            type="button"
            onClick={() => !isActive && onSwitch(locale.language)}
            aria-current={isActive ? 'true' : undefined}
            className={[
              'py-3 px-3 text-sm font-medium border-b-2 transition-colors',
              isActive
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300',
            ].join(' ')}
          >
            {locale.label}
            {locale.isPrimary && (
              <span className="ml-1 text-[10px] text-zinc-400 font-normal">主</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
