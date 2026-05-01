import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('health')
  async health() {
    return this.searchService.health();
  }

  @Post('bootstrap')
  @UseGuards(JwtAuthGuard)
  async bootstrap() {
    return this.searchService.bootstrap();
  }
}
