import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { PRISMA_PUBLIC_CLIENT } from '../database/database.tokens';
import type { PrismaClient } from '../generated/prisma';

class RecordMetricDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsNumber()
  @Min(-1e12)
  @Max(1e12)
  @Type(() => Number)
  value!: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsString()
  brandId?: string;
}

@Controller('metrics')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class MetricController {
  constructor(@Inject(PRISMA_PUBLIC_CLIENT) private readonly prisma: PrismaClient) {}

  /**
   * List recorded metrics. Agents use this to read historical KPI values.
   */
  @Get()
  @RequirePolicy({ obj: 'metrics', act: 'read', field: '*' })
  async list(
    @Query('name') name?: string,
    @Query('brandId') brandId?: string,
    @Query('limit') limit?: string,
  ) {
    const take = Math.min(parseInt(limit ?? '50', 10), 200);
    const where: Record<string, unknown> = {};
    if (name) {
      where['name'] = name;
    }
    if (brandId) {
      where['brandId'] = brandId;
    }

    const records = await this.prisma.metric.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      take,
      select: { id: true, name: true, value: true, unit: true, brandId: true, recordedAt: true },
    });
    return { records, total: records.length };
  }

  /**
   * Record a new metric data point. Agents use this to log KPI values programmatically.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePolicy({ obj: 'metrics', act: 'write', field: '*' })
  async record(@Body() dto: RecordMetricDto) {
    if (dto.value === undefined || dto.value === null) {
      throw new BadRequestException('value is required');
    }
    const metric = await this.prisma.metric.create({
      data: {
        name: dto.name,
        value: dto.value,
        unit: dto.unit,
        brandId: dto.brandId,
      },
      select: { id: true, name: true, value: true, unit: true, brandId: true, recordedAt: true },
    });
    return metric;
  }
}
