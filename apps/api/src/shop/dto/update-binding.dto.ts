import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateBindingDto {
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  unbind?: boolean;
}
