import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CasbinGuard } from '../iam/casbin.guard';
import { RequirePolicy } from '../iam/require-policy.decorator';
import { PlatformService } from './platform.service';

@Controller('platforms')
@UseGuards(JwtAuthGuard, CasbinGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get()
  @RequirePolicy({ obj: 'settings', act: 'read', field: '*' })
  list() {
    return this.platformService.list();
  }

  @Get(':id')
  @RequirePolicy({ obj: 'settings', act: 'read', field: '*' })
  getById(@Param('id') id: string) {
    return this.platformService.getById(id);
  }
}
