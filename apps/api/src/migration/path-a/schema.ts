import { z } from 'zod';

const optionalNonEmptyString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .transform((value) => value ?? undefined);

const stringOrArray = z.union([z.string(), z.array(z.string())]).optional();

export const lingxingPathARawListingSchema = z.object({
  product_id: optionalNonEmptyString,
  seller_sku: z.string().trim().min(1),
  asin: optionalNonEmptyString,
  listing_title: optionalNonEmptyString,
  bullet_points: stringOrArray,
  description: optionalNonEmptyString,
  search_terms: stringOrArray,
  marketplace_id: optionalNonEmptyString,
  shop_id: optionalNonEmptyString,
  brand_name: optionalNonEmptyString,
  category_name: optionalNonEmptyString,
  status: optionalNonEmptyString,
  updated_at: optionalNonEmptyString,
});

export const pathAExtractionInputSchema = z.object({
  runId: z.string().trim().min(1),
  sourceRecordId: z.string().trim().min(1),
  rawListing: lingxingPathARawListingSchema,
});

export const pathAExtractionResultSchema = z.object({
  runId: z.string().trim().min(1),
  sourceRecordId: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  asin: z.string().trim().min(1).nullable(),
  title: z.string().trim().min(1),
  bulletPoints: z.array(z.string().trim().min(1)).default([]),
  description: z.string().trim().default(''),
  searchTerms: z.array(z.string().trim().min(1)).default([]),
  marketplaceId: z.string().trim().min(1),
  lingxingShopId: z.string().trim().min(1).nullable(),
  brandName: z.string().trim().min(1),
  categoryName: z.string().trim().min(1).nullable(),
  lingxingUpdatedAt: z.string().trim().min(1).nullable(),
});

export const pathAExtractionModelOutputSchema = pathAExtractionResultSchema.omit({
  runId: true,
  sourceRecordId: true,
});

export type LingxingPathARawListingSchema = z.infer<typeof lingxingPathARawListingSchema>;
export type PathAExtractionInputSchema = z.infer<typeof pathAExtractionInputSchema>;
export type PathAExtractionResultSchema = z.infer<typeof pathAExtractionResultSchema>;
export type PathAExtractionModelOutputSchema = z.infer<typeof pathAExtractionModelOutputSchema>;
