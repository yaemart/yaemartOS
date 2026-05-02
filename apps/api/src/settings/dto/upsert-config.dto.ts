import { IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class UpsertConfigDto {
  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsString()
  @IsOptional()
  label?: string;
}
