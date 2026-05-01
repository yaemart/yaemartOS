import { Controller, Get, Inject } from '@nestjs/common';
import type { IListingGenerationService } from './interfaces/listing-generation.interface';
import { LISTING_GENERATION_SERVICE } from './tokens';

@Controller('ai')
export class AiController {
  constructor(
    @Inject(LISTING_GENERATION_SERVICE)
    private readonly listingGeneration: IListingGenerationService,
  ) {}

  @Get('hello')
  async hello() {
    const message = await this.listingGeneration.helloWorld();
    return { message };
  }
}
