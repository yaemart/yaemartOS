import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTerminologyDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  definition?: string;

  @IsString()
  @IsOptional()
  example?: string;
}
