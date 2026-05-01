import { Module } from '@nestjs/common';
import { CategoryModule } from '../category/category.module';
import { AuditService } from '../common/audit/audit.service';
import { IamModule } from '../iam/casbin.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [IamModule, CategoryModule],
  controllers: [ProductController],
  providers: [ProductService, AuditService],
  exports: [ProductService],
})
export class ProductModule {}
