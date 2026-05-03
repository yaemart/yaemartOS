import { IsString, MaxLength, MinLength } from 'class-validator';

export class OrderLookupDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  orderNumber!: string;

  @IsString()
  @MinLength(1)
  turnstileToken!: string;
}
