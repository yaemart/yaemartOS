import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateSuggestionDto {
  @IsString()
  @MinLength(1)
  shopId!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
