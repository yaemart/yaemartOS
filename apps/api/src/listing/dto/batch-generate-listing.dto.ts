import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export const BATCH_LOCALES = ['en', 'es', 'fr', 'de', 'it', 'ja'] as const;

export class BatchGenerateTargetDto {
  @IsString()
  shopId!: string;

  /** Platform code; used to resolve the platform record. */
  @IsString()
  platformCode!: string;

  /** Seller-centre / platform-side listing ID (e.g. ASIN, Walmart Item ID). */
  @IsString()
  @MaxLength(256)
  platformListingId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competitorUrls?: string[];

  @IsOptional()
  @IsString()
  manualSellingPoints?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryLexicon?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lingxingKeywordSeed?: string[];
}

export class BatchGenerateListingDto {
  @IsString()
  productId!: string;

  @IsString()
  brandId!: string;

  @IsString()
  marketId!: string;

  @IsString()
  productTitle!: string;

  @IsString()
  productCategory!: string;

  /**
   * Multi-language batch: provide an array of locale codes.
   * Takes priority over the legacy `language` field.
   * e.g. ['en', 'es', 'fr'] generates 3 × targets.length versions.
   */
  @IsOptional()
  @IsArray()
  @IsIn(BATCH_LOCALES, { each: true })
  languages?: string[];

  /**
   * @deprecated Use `languages` instead. Kept for backward-compatibility.
   * If only `language` is provided, it is treated as `languages: [language]`.
   */
  @IsOptional()
  @IsIn(BATCH_LOCALES)
  language?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchGenerateTargetDto)
  targets!: BatchGenerateTargetDto[];
}
