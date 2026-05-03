import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { MarketService } from './market.service';

class CreateMarketDto {
  @IsString() @IsNotEmpty() brandId!: string;
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() currency!: string;
  @IsString() @IsNotEmpty() timezone!: string;
}

class UpdateMarketDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() timezone?: string;
}

@Controller('markets')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get()
  @RequirePolicy({ obj: 'settings', act: 'read', field: '*' })
  list(@Query('brandId') brandId?: string) {
    return this.marketService.list(brandId);
  }

  @Get(':id')
  @RequirePolicy({ obj: 'settings', act: 'read', field: '*' })
  getById(@Param('id') id: string) {
    return this.marketService.getById(id);
  }

  @Post()
  @RequirePolicy({ obj: 'settings', act: 'write', field: '*' })
  create(@Body() dto: CreateMarketDto) {
    return this.marketService.create(dto);
  }

  @Patch(':id')
  @RequirePolicy({ obj: 'settings', act: 'write', field: '*' })
  update(@Param('id') id: string, @Body() dto: UpdateMarketDto) {
    return this.marketService.update(id, dto);
  }

  @Delete(':id')
  @RequirePolicy({ obj: 'settings', act: 'write', field: '*' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.marketService.remove(id);
  }
}
