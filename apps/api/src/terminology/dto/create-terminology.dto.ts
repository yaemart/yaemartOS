import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { LocaleCode } from '../../generated/prisma';

export class CreateTerminologyDto {
  @IsString()
  brandId!: string;

  @IsEnum(LocaleCode)
  locale!: LocaleCode;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @MinLength(1)
  term!: string;

  @IsString()
  @MinLength(1)
  definition!: string;

  @IsString()
  @IsOptional()
  example?: string;
}
