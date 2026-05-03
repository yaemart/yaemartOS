import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { CustomerTenantGuard } from '../customer-tenant.guard';
import { ArticlePublicService } from './article-public.service';

const PRODUCTS_THROTTLE = { default: { limit: 100, ttl: 60000 } } as const;

@Controller('customer')
@UseGuards(CustomerTenantGuard)
export class ArticlePublicController {
  constructor(
    private readonly articlePublicService: ArticlePublicService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get('products')
  @Throttle(PRODUCTS_THROTTLE)
  listProducts(
    @Query('locale') locale?: string,
    @Query('brandId') brandId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.articlePublicService.listProducts({
      locale,
      brandId,
      page: page !== undefined ? parseInt(page, 10) : undefined,
      limit: limit !== undefined ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('products/:slug')
  @Throttle(PRODUCTS_THROTTLE)
  getProduct(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.articlePublicService.getProduct(slug, locale);
  }

  @Get('config/privacy-policy')
  @Throttle(PRODUCTS_THROTTLE)
  getPrivacyPolicy(@Query('locale') locale?: string) {
    const brandId = this.tenantContext.getTenant();
    return this.articlePublicService.getPrivacyPolicy(brandId, locale);
  }
}
