import { IsIn, IsOptional } from 'class-validator';

const LOCALES = ['en', 'es', 'fr', 'de', 'it'] as const;

export class UpdateTemplateDto {
  @IsIn(LOCALES)
  locale!: 'en' | 'es' | 'fr' | 'de' | 'it';

  @IsOptional()
  titleTemplate?: unknown;

  @IsOptional()
  bulletsTemplate?: unknown;

  @IsOptional()
  descriptionGuide?: unknown;

  @IsOptional()
  specParams?: unknown;

  @IsOptional()
  featureWords?: unknown;

  @IsOptional()
  sellingPoints?: unknown;

  @IsOptional()
  faqTemplate?: unknown;

  @IsOptional()
  recipeTemplate?: unknown;
}
