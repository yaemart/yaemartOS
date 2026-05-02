import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'ja'] as const;

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

  @IsIn(LOCALES)
  language!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchGenerateTargetDto)
  targets!: BatchGenerateTargetDto[];
}
