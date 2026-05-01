import { IsIn, IsOptional } from 'class-validator';

const LOCALES = ['en', 'es', 'fr', 'de', 'it'] as const;

export class UpdateContentDto {
  @IsIn(LOCALES)
  locale!: 'en' | 'es' | 'fr' | 'de' | 'it';

  @IsOptional()
  payload?: unknown;
}
