import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { DatabaseModule } from '../database/database.module';
import { IamModule } from '../iam/casbin.module';
import { TicketAggregationController } from './ticket-aggregation/ticket-aggregation.controller';
import { TicketAggregationService } from './ticket-aggregation/ticket-aggregation.service';
import { AdminManualController } from './manual/admin-manual.controller';
import { AdminManualService } from './manual/admin-manual.service';
import { AdminWarrantyController } from './warranty/admin-warranty.controller';
import { AdminWarrantyService } from './warranty/admin-warranty.service';
import { AdminOrderLookupController } from './order-lookup/admin-order-lookup.controller';
import { AdminCustomerController } from './customer/admin-customer.controller';

@Module({
  imports: [IamModule, DatabaseModule, CloudinaryModule],
  controllers: [
    TicketAggregationController,
    AdminManualController,
    AdminWarrantyController,
    AdminOrderLookupController,
    AdminCustomerController,
  ],
  providers: [TicketAggregationService, AdminManualService, AdminWarrantyService],
})
export class AdminModule {}
