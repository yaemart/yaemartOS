import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWarrantyDto {
  @IsString()
  @MaxLength(100)
  productSku: string;

  @IsString()
  @MaxLength(100)
  serialNumber: string;

  @IsISO8601()
  purchaseDate: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shopOrderId?: string;
}
