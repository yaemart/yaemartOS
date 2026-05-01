import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const LOCALES = ['en', 'es', 'fr', 'de', 'it'] as const;

export class CreateProductDto {
  @IsString()
  @MaxLength(64)
  brandId!: string;

  @IsString()
  @MaxLength(64)
  categoryId!: string;

  @IsString()
  @MaxLength(64)
  sku!: string;

  @IsString()
  @MaxLength(256)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(LOCALES)
  locale?: 'en' | 'es' | 'fr' | 'de' | 'it';
}
