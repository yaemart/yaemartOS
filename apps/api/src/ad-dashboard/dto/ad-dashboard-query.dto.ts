import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';

const MAX_RANGE_DAYS = 90;
const AD_TYPES = ['sp', 'sd', 'sb', 'walmart_sp'] as const;

@ValidatorConstraint({ name: 'dateRangeMax90Days', async: false })
export class DateRangeMax90DaysConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as AdDashboardQueryDto;
    if (!obj.startDate || !obj.endDate) {
      return true;
    }
    const start = new Date(obj.startDate).getTime();
    const end = new Date(obj.endDate).getTime();
    if (isNaN(start) || isNaN(end)) {
      return true;
    }
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= MAX_RANGE_DAYS;
  }

  defaultMessage(): string {
    return `Date range must not exceed ${MAX_RANGE_DAYS} days and endDate must be >= startDate`;
  }
}

export class AdDashboardQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  @Validate(DateRangeMax90DaysConstraint)
  endDate!: string;

  @IsOptional()
  @IsString()
  shopId?: string;

  @IsOptional()
  @IsIn(AD_TYPES)
  adType?: (typeof AD_TYPES)[number];
}
