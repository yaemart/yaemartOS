import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const TRAFFIC_STRATEGIES = [
  'primary',
  'variant',
  'bundle',
  'keyword_grab',
  'seasonal',
  'cohort_test',
] as const;

const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'ja'] as const;

export class CreateListingDto {
  @IsString()
  productId!: string;

  @IsString()
  @MaxLength(64)
  brandId!: string;

  @IsString()
  marketId!: string;

  @IsString()
  platformId!: string;

  @IsString()
  shopId!: string;

  @IsIn(LOCALES)
  language!: string;

  @IsString()
  @MaxLength(256)
  platformListingId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsIn(TRAFFIC_STRATEGIES)
  trafficStrategy?: string;
}
