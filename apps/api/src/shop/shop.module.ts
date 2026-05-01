import { Module } from '@nestjs/common';
import { AuditService } from '../common/audit/audit.service';
import { IamModule } from '../iam/casbin.module';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';

@Module({
  imports: [IamModule],
  controllers: [ShopController],
  providers: [ShopService, AuditService],
  exports: [ShopService],
})
export class ShopModule {}
