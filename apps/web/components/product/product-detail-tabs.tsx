'use client';

import { useMemo, useState } from 'react';
import { SourceBadge } from './source-badge';

type ProductDetail = {
  id: string;
  title: string;
  sku: string;
  brandId: string;
  category?: { name: string } | null;
  description: string | null;
  contents: Array<{ id: string; source: string; payload: unknown }>;
  listings: Array<{ id: string; status: string; language: string }>;
};

const TABS = ['基本信息', 'Listing', 'FAQ/菜谱', '审计日志'] as const;
type TabKey = (typeof TABS)[number];

export function ProductDetailTabs({ product }: { product: ProductDetail }) {
  const [activeTab, setActiveTab] = useState<TabKey>('基本信息');
  const faqContent = useMemo(() => {
    const payload = product.contents[0]?.payload;
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    return payload as Record<string, unknown>;
  }, [product.contents]);

  return (
    <div>
      <div className="flex gap-5 border-b border-zinc-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-1 py-3 text-sm ${
              activeTab === tab
                ? 'border-[rgb(var(--brand-primary))] font-medium text-[rgb(var(--brand-primary))]'
                : 'border-transparent text-zinc-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6">
        {activeTab === '基本信息' ? (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-zinc-500">SKU：</span>
              {product.sku}
            </p>
            <p>
              <span className="text-zinc-500">品牌：</span>
              {product.brandId}
            </p>
            <p>
              <span className="text-zinc-500">品类：</span>
              {product.category?.name ?? '-'}
            </p>
            <p>
              <span className="text-zinc-500">描述：</span>
              {product.description ?? '-'}
            </p>
          </div>
        ) : null}

        {activeTab === 'Listing' ? (
          <div className="space-y-2 text-sm text-zinc-600">
            {product.listings.length === 0 ? (
              <p>暂无 Listing</p>
            ) : (
              product.listings.map((listing) => (
                <p key={listing.id}>
                  {listing.id} · {listing.language} · {listing.status}
                </p>
              ))
            )}
          </div>
        ) : null}

        {activeTab === 'FAQ/菜谱' ? (
          <div className="space-y-3 text-sm text-zinc-600">
            <SourceBadge source={product.contents[0]?.source ?? 'manual'} />
            <pre className="overflow-auto rounded-md bg-zinc-50 p-3 text-xs">
              {faqContent ? JSON.stringify(faqContent, null, 2) : '暂无内容'}
            </pre>
          </div>
        ) : null}

        {activeTab === '审计日志' ? (
          <p className="text-sm text-zinc-500">审计日志将在后续切片接入可视化。</p>
        ) : null}
      </div>
    </div>
  );
}
