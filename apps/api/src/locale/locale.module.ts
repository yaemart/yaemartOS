import { Module } from '@nestjs/common';
import { IamModule } from '../iam/casbin.module';
import { LocaleController } from './locale.controller';
import { LocaleService } from './locale.service';

@Module({
  imports: [IamModule],
  controllers: [LocaleController],
  providers: [LocaleService],
  exports: [LocaleService],
})
export class LocaleModule {}
