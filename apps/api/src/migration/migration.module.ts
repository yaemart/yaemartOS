import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AuditService } from '../common/audit/audit.service';
import { IamModule } from '../iam/casbin.module';
import { PathAImportService } from './path-a/path-a-import.service';
import { PathAImportProcessor } from './path-a/path-a-import.processor';
import { PATH_A_IMPORT_QUEUE } from './path-a/path-a-import.job';
import { MigrationController } from './migration.controller';

@Module({
  imports: [ConfigModule, IamModule, BullModule.registerQueue({ name: PATH_A_IMPORT_QUEUE })],
  controllers: [MigrationController],
  providers: [PathAImportService, PathAImportProcessor, AuditService],
  exports: [PathAImportService],
})
export class MigrationModule {}
