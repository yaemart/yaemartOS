import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
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
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateBindingDto } from './dto/update-binding.dto';

@Controller('shops')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class ShopController {
  private readonly logger = new Logger(ShopController.name);

  constructor(private readonly shopService: ShopService) {}

  /** List all shops for the request brand, including platform and market names. */
  @Get()
  @RequirePolicy({ obj: 'shops', act: 'read' })
  async list(@Headers('x-yaemart-brand') brandId?: string) {
    return this.shopService.list(brandId ?? '');
  }

  /** List Lingxing shops available for binding (cached 1 req/s rate-limited). */
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

  /** Get a single shop by internal ID (used by Agent and detail views). */
  @Get(':id')
  @RequirePolicy({ obj: 'shops', act: 'read' })
  async getById(@Param('id') id: string) {
    return this.shopService.getById(id);
  }

  /** Bind an internal shop to a Lingxing shop ID; sets syncEnabled = true. */
  @Post(':id/bind')
  @RequirePolicy({ obj: 'shops', act: 'write' })
  async bind(@Param('id') id: string, @Body() dto: BindShopDto, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    return this.shopService.bind(id, dto, user?.id);
  }

  /** Create a new shop record (platform + market + brand). */
  @Post()
  @RequirePolicy({ obj: 'shops', act: 'write' })
  async create(@Body() dto: CreateShopDto, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    return this.shopService.create(dto, user?.id);
  }

  /** Toggle syncEnabled or soft-unbind (pass unbind:true) for an existing ShopBinding. */
  @Patch(':id/binding')
  @RequirePolicy({ obj: 'shops', act: 'write' })
  async updateBinding(@Param('id') id: string, @Body() dto: UpdateBindingDto, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    return this.shopService.updateBinding(id, dto, user?.id);
  }

  /** Delete a shop record (hard delete; also cascades binding). */
  @Delete(':id')
  @HttpCode(204)
  @RequirePolicy({ obj: 'shops', act: 'write' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { id?: string } | undefined;
    await this.shopService.delete(id, user?.id);
  }
}
