import { Module } from '@nestjs/common';
import { IamModule } from '../iam/casbin.module';
import { TicketAggregationController } from './ticket-aggregation/ticket-aggregation.controller';
import { TicketAggregationService } from './ticket-aggregation/ticket-aggregation.service';

@Module({
  imports: [IamModule],
  controllers: [TicketAggregationController],
  providers: [TicketAggregationService],
})
export class AdminModule {}
