import {
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { ShopService } from './shop.service';
import { BindShopDto } from './dto/bind-shop.dto';
import { UpdateBindingDto } from './dto/update-binding.dto';

@Controller('shops')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class ShopController {
  private readonly logger = new Logger(ShopController.name);

  constructor(private readonly shopService: ShopService) {}

  @Get()
  @RequirePolicy({ obj: 'shops', act: 'read' })
  async list(@Headers('x-yaemart-brand') brandId?: string) {
    return this.shopService.list(brandId ?? '');
  }

  @Get('lingxing-available')
  @RequirePolicy({ obj: 'shops', act: 'read' })
  async getLingxingShops() {
    try {
      return await this.shopService.getLingxingShops();
    } catch (err) {
      this.logger.warn(`Lingxing shops unavailable: ${String(err)}`);
      return [];
    }
  }

  @Post(':id/bind')
  @RequirePolicy({ obj: 'shops', act: 'write' })
  async bind(@Param('id') id: string, @Body() dto: BindShopDto, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    return this.shopService.bind(id, dto, user?.id);
  }

  @Patch(':id/binding')
  @RequirePolicy({ obj: 'shops', act: 'write' })
  async updateBinding(@Param('id') id: string, @Body() dto: UpdateBindingDto, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    return this.shopService.updateBinding(id, dto, user?.id);
  }
}
