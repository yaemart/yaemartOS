import type { LingxingPathARawListing } from './types';

export function buildPathAExtractionPrompt(raw: LingxingPathARawListing): string {
  return [
    'You are a data extraction engine for cross-border ecommerce listings.',
    'Convert the given Lingxing listing payload into strict JSON.',
    'Rules:',
    '1) Output valid JSON only, no markdown.',
    '2) Keep original language, do not translate.',
    '3) Missing optional values should be null or empty array.',
    '4) title must never be empty; if listing_title missing, use seller_sku.',
    '5) bulletPoints/searchTerms must be string arrays.',
    'Required JSON fields:',
    '{"sku","asin","title","bulletPoints","description","searchTerms","marketplaceId","lingxingShopId","brandName","categoryName","lingxingUpdatedAt"}',
    '',
    'Input payload:',
    JSON.stringify(raw),
  ].join('\n');
}
