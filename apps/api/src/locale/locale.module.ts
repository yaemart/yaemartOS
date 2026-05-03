import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LocaleController } from './locale.controller';
import { LocaleService } from './locale.service';

@Module({
  imports: [PrismaModule],
  controllers: [LocaleController],
  providers: [LocaleService],
  exports: [LocaleService],
})
export class LocaleModule {}
