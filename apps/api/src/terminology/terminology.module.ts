import { Module } from '@nestjs/common';
import { IamModule } from '../iam/casbin.module';
import { TerminologyController } from './terminology.controller';
import { TerminologyService } from './terminology.service';

@Module({
  imports: [IamModule],
  controllers: [TerminologyController],
  providers: [TerminologyService],
  exports: [TerminologyService],
})
export class TerminologyModule {}
