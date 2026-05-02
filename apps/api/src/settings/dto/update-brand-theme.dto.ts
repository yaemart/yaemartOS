import { IsOptional, IsString } from 'class-validator';

export class UpdateBrandThemeDto {
  @IsString()
  @IsOptional()
  themeColor?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  name?: string;
}
