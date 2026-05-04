import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateSuggestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  shopId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
