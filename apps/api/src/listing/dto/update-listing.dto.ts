import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

const LISTING_STATUSES = [
  'draft',
  'review',
  'approved',
  'published',
  'paused',
  'archived',
] as const;
const TRAFFIC_STRATEGIES = [
  'primary',
  'variant',
  'bundle',
  'keyword_grab',
  'seasonal',
  'cohort_test',
] as const;

export class UpdateListingDto {
  @IsOptional()
  @IsIn(LISTING_STATUSES)
  status?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsIn(TRAFFIC_STRATEGIES)
  trafficStrategy?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  bullets?: string[];

  @IsOptional()
  @IsString()
  searchTerms?: string;
}
