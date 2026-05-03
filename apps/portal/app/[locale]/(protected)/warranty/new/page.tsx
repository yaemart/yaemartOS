'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerWarranty } from '../../../../../lib/api/customer-api-client';

const PLATFORMS = ['Amazon', 'Walmart', 'Other'];
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

interface WarrantyNewPageProps {
  params: Promise<{ locale: string }>;
}

export default function WarrantyNewPage({ params }: WarrantyNewPageProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [locale, setLocale] = useState('en');

  // Resolve route locale for email template selection
  useEffect(() => {
    params.then(({ locale: l }) => setLocale(l));
  }, [params]);

  const [productSku, setProductSku] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [platform, setPlatform] = useState('');
  const [shopOrderId, setShopOrderId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFileChange = useCallback(() => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setFileError(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('Only JPEG, PNG, WebP, or PDF files are accepted.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('File size must not exceed 5 MB.');
      return;
    }
    setFileError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!agreed) {
        return;
      }

      const accessToken = sessionStorage.getItem('access_token');
      if (!accessToken) {
        router.push('/login');
        return;
      }

      setSubmitting(true);
      setSubmitError(null);

      try {
        const formData = new FormData();
        formData.append('productSku', productSku);
        formData.append('serialNumber', serialNumber);
        formData.append('purchaseDate', purchaseDate);
        if (platform) {
          formData.append('platform', platform);
        }
        if (shopOrderId) {
          formData.append('shopOrderId', shopOrderId);
        }

        const file = fileRef.current?.files?.[0];
        if (file) {
          formData.append('invoiceFile', file);
        }

        const result = await registerWarranty(formData, locale, accessToken);

        router.push(`/warranty/success?expires=${encodeURIComponent(result.warrantyExpiresAt)}`);
      } catch (err: unknown) {
        const msg =
          typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Registration failed. Please try again.';
        setSubmitError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [agreed, locale, productSku, serialNumber, purchaseDate, platform, shopOrderId, router],
  );

  return (
    <div className="max-w-lg mx-auto p-4 pb-16">
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1">Register Warranty</h1>
        <p className="text-sm text-gray-500">
          Register your product to activate warranty coverage.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product SKU <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={productSku}
            onChange={(e) => setProductSku(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{ '--tw-ring-color': 'var(--color-primary, #1a1a1a)' } as React.CSSProperties}
            placeholder="e.g. HT-001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Serial Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
            placeholder="Found on the product label"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Purchase Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            required
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
          >
            <option value="">Select platform (optional)</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Order Number</label>
          <input
            type="text"
            value={shopOrderId}
            onChange={(e) => setShopOrderId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
            placeholder="Platform order number (optional)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Proof of Purchase</label>
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white cursor-pointer"
            style={{ '--file-bg': 'var(--color-primary, #1a1a1a)' } as React.CSSProperties}
          />
          <p className="text-xs text-gray-400 mt-1">
            JPEG, PNG, WebP, or PDF · Max 5 MB (optional)
          </p>
          {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
        </div>

        <div className="flex items-start gap-3 pt-1">
          <input
            id="agree"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded"
          />
          <label htmlFor="agree" className="text-sm text-gray-600">
            I agree to the warranty terms and conditions.
          </label>
        </div>

        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={!agreed || submitting || !!fileError}
          className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-primary, #1a1a1a)' }}
        >
          {submitting ? 'Submitting…' : 'Register Warranty'}
        </button>
      </form>
    </div>
  );
}
