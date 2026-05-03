import { Module } from '@nestjs/common';
import { IamModule } from '../iam/casbin.module';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({
  imports: [IamModule],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
