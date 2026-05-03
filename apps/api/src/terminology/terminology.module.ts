import { Module } from '@nestjs/common';
import { IamModule } from '../iam/casbin.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TerminologyController } from './terminology.controller';
import { TerminologyService } from './terminology.service';

@Module({
  imports: [PrismaModule, IamModule],
  controllers: [TerminologyController],
  providers: [TerminologyService],
  exports: [TerminologyService],
})
export class TerminologyModule {}
