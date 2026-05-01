import { Module } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { IamModule } from '../iam/casbin.module';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [IamModule],
  controllers: [CategoryController],
  providers: [CategoryService, AuditService],
  exports: [CategoryService],
})
export class CategoryModule {}
