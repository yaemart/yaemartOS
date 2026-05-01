import { IsBoolean } from 'class-validator';

export class UpdateBindingDto {
  @IsBoolean()
  syncEnabled!: boolean;
}
