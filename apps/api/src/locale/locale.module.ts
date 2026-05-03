import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LocaleService } from './locale.service';

@Module({
  imports: [PrismaModule],
  providers: [LocaleService],
  exports: [LocaleService],
})
export class LocaleModule {}
