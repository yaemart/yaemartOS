import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ClsService } from 'nestjs-cls';
import { CustomerGuard } from '../customer-auth/customer.guard';
import { CustomerTenantGuard } from '../customer-tenant.guard';
import { RequireFeatureFlag } from '../../common/feature-flag/require-feature-flag.decorator';
import { FeatureFlagGuard } from '../../common/feature-flag/feature-flag.guard';
import { CreateWarrantyDto } from './dto/create-warranty.dto';
import { WarrantyService } from './warranty.service';

const ALLOWED_INVOICE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_INVOICE_BYTES = 5 * 1024 * 1024;

const WARRANTY_THROTTLE = { default: { limit: 10, ttl: 60000 } } as const;

@Controller('customer/warranties')
@UseGuards(CustomerTenantGuard, CustomerGuard, FeatureFlagGuard)
@RequireFeatureFlag('WARRANTY_REGISTRATION')
export class WarrantyController {
  constructor(
    private readonly warrantyService: WarrantyService,
    private readonly cls: ClsService,
  ) {}

  @Post()
  @Throttle(WARRANTY_THROTTLE)
  @UseInterceptors(FileInterceptor('invoiceFile'))
  async register(
    @Body() dto: CreateWarrantyDto,
    @Query('locale') locale = 'en',
    @UploadedFile() invoiceFile?: Express.Multer.File,
  ) {
    if (invoiceFile) {
      if (!ALLOWED_INVOICE_MIMES.has(invoiceFile.mimetype)) {
        throw new BadRequestException('Invoice must be JPEG, PNG, WebP, or PDF');
      }
      if (invoiceFile.size > MAX_INVOICE_BYTES) {
        throw new BadRequestException('Invoice file size must not exceed 5 MB');
      }
    }

    const customerId = this.cls.get<string>('customerId');
    return this.warrantyService.register(customerId, dto, invoiceFile?.buffer, locale);
  }

  @Get()
  @Throttle(WARRANTY_THROTTLE)
  listWarranties() {
    const customerId = this.cls.get<string>('customerId');
    return this.warrantyService.listByCustomer(customerId);
  }

  @Get(':warrantyId')
  @Throttle(WARRANTY_THROTTLE)
  findOne(@Param('warrantyId') warrantyId: string) {
    const customerId = this.cls.get<string>('customerId');
    return this.warrantyService.findOne(warrantyId, customerId);
  }
}
