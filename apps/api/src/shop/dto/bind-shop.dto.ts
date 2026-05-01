import { IsString, IsOptional } from 'class-validator';

export class BindShopDto {
  @IsString()
  lingxingShopId!: string;

  @IsOptional()
  @IsString()
  bindingToken?: string;
}
