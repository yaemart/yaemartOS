import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(64)
  brandId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  parentId?: string;

  @IsString()
  @MaxLength(128)
  name!: string;

  @IsString()
  @MaxLength(128)
  slug!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresRecipe?: boolean;
}
