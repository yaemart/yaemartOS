import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateShopDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  platformId!: string;

  @IsString()
  marketId!: string;

  @IsString()
  brandId!: string;

  /** External ID on the platform (e.g. Amazon Seller account ID). */
  @IsString()
  externalId!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
