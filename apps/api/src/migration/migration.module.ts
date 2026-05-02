import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AuditService } from '../common/audit/audit.service';
import { IamModule } from '../iam/casbin.module';
import { PathAImportService } from './path-a/path-a-import.service';
import { PathAImportProcessor } from './path-a/path-a-import.processor';
import { PATH_A_IMPORT_QUEUE } from './path-a/path-a-import.job';
import { MigrationController } from './migration.controller';

@Module({
  imports: [
    ConfigModule,
    IamModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port) || 6379,
            password: url.password || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: PATH_A_IMPORT_QUEUE }),
  ],
  controllers: [MigrationController],
  providers: [PathAImportService, PathAImportProcessor, AuditService],
  exports: [PathAImportService],
})
export class MigrationModule {}
