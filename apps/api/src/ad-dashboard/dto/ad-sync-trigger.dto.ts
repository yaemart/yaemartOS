import { IsDateString, IsString } from 'class-validator';

export class AdSyncTriggerDto {
  @IsString()
  shopId!: string;

  @IsDateString()
  date!: string;
}
