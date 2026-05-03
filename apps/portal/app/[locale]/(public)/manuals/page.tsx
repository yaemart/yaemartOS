'use client';

import { useCallback, useEffect, useState } from 'react';
import { listManuals, type ManualItem } from '../../../../lib/api/customer-api-client';

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
];

interface ManualsPageProps {
  params: Promise<{ locale: string }>;
}

export default function ManualsPage({ params }: ManualsPageProps) {
  const [locale, setLocale] = useState('en');
  const [manuals, setManuals] = useState<ManualItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocale, setSelectedLocale] = useState<string>('en');

  useEffect(() => {
    params.then(({ locale: l }) => {
      setLocale(l);
      setSelectedLocale(l);
    });
  }, [params]);

  const fetchManuals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listManuals();
      setManuals(data);
    } catch {
      setError('Failed to load manuals. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManuals();
  }, [fetchManuals]);

  const grouped = manuals.reduce<Record<string, ManualItem[]>>((acc, m) => {
    if (!acc[m.productSku]) {
      acc[m.productSku] = [];
    }
    acc[m.productSku].push(m);
    return acc;
  }, {});

  const skus = Object.keys(grouped).sort();

  return (
    <div className="max-w-2xl mx-auto p-4 pb-16">
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1">Product Manuals</h1>
        <p className="text-sm text-gray-500">Download user manuals in your preferred language.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {LOCALES.map((l) => (
          <button
            key={l.code}
            onClick={() => setSelectedLocale(l.code)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedLocale === l.code
                ? 'text-white'
                : 'border text-gray-600 hover:border-gray-400'
            }`}
            style={
              selectedLocale === l.code
                ? { backgroundColor: 'var(--color-primary, #1a1a1a)' }
                : undefined
            }
          >
            {l.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-16 text-gray-400 text-sm">Loading manuals…</div>}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && skus.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm">
          No manuals available at this time.
        </div>
      )}

      {!loading && skus.length > 0 && (
        <div className="space-y-3">
          {skus.map((sku) => {
            const available = grouped[sku];
            const match =
              available.find((m) => m.locale === selectedLocale) ??
              available.find((m) => m.locale === 'en') ??
              available[0];

            return (
              <div
                key={sku}
                className="flex items-center justify-between border rounded-lg px-4 py-3 gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm">{sku}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {available.map((m) => m.locale.toUpperCase()).join(' · ')}
                  </p>
                </div>
                <a
                  href={match.secureUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={match.filename}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-primary, #1a1a1a)' }}
                >
                  Download {match.locale.toUpperCase()}
                </a>
              </div>
            );
          })}
        </div>
      )}

      {locale && <div className="hidden">{locale}</div>}
    </div>
  );
}
