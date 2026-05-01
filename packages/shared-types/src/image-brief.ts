import type { BrandId, Locale, Platform } from './index';

/** Status lifecycle of an image brief. */
export type ImageBriefStatus = 'draft' | 'review' | 'approved' | 'archived';

/** Four asset categories defined in image-brief-v1.md. */
export type ImageAssetType = 'main' | 'scene' | 'aplus' | 'infographic';

export interface ImageAssetSpec {
  type: ImageAssetType;
  /** Recommended filename pattern, e.g. "main-01.jpg" */
  filename: string;
  /** Width in pixels */
  widthPx: number;
  /** Height in pixels */
  heightPx: number;
  /** Short description of content or scene */
  description?: string;
}

/**
 * Structured image brief — maps to docs/templates/image-brief-v1.md.
 * Cloudinary folder: `/{brandId}/{sku}/`
 */
export interface ImageBrief {
  /** Unique identifier: IMG-{BRAND}-{YYYYMMDD}-{SEQ} */
  briefId: string;
  productSku: string;
  productName: string;
  brandId: BrandId;
  marketLocale: Locale;
  platform: Platform;
  /** Cloudinary destination folder */
  cloudinaryFolder: string;
  dueDate: string;
  status: ImageBriefStatus;
  assets: ImageAssetSpec[];
  /** Free-text notes for the designer */
  designNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Convenience presets ─────────────────────────────────────────────────────

/** Default asset specs for an Amazon EN listing. */
export const AMAZON_EN_ASSET_SPECS: ImageAssetSpec[] = [
  { type: 'main', filename: 'main-01.jpg', widthPx: 3000, heightPx: 3000 },
  { type: 'main', filename: 'main-02.jpg', widthPx: 3000, heightPx: 3000 },
  { type: 'scene', filename: 'scene-01.jpg', widthPx: 2000, heightPx: 2000 },
  { type: 'scene', filename: 'scene-02.jpg', widthPx: 2000, heightPx: 2000 },
  { type: 'aplus', filename: 'aplus-banner.jpg', widthPx: 970, heightPx: 600 },
  { type: 'aplus', filename: 'aplus-feature-01.jpg', widthPx: 600, heightPx: 600 },
  { type: 'aplus', filename: 'aplus-feature-02.jpg', widthPx: 600, heightPx: 600 },
  { type: 'infographic', filename: 'info-01.jpg', widthPx: 2000, heightPx: 2000 },
  { type: 'infographic', filename: 'info-02.jpg', widthPx: 2000, heightPx: 2000 },
];
