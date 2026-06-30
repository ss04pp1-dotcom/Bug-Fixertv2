import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { M3uImportController } from './m3u-import.controller';
import { M3uImportService, QUEUE_M3U_IMPORT, QUEUE_HEALTH_CHECK } from './m3u-import.service';
import { M3uParserService } from './m3u-parser.service';
import { StreamValidationService } from './stream-validation.service';
import { M3uImportConsumer } from './m3u-import.consumer';
import { HealthCheckConsumer } from './health-check.consumer';
import { HealthCheckScheduler } from './health-check.scheduler';
import { AutoCleanupScheduler } from './auto-cleanup.scheduler';
import { PrismaModule } from '../prisma/prisma.module';

const REDIS_URL = process.env['REDIS_URL'];

// Same defensive ioredis options as jobs.module.ts — prevents startup crash when
// Redis is temporarily unreachable or the URL has an SSL mismatch.
const bullImports = REDIS_URL
  ? [
      BullModule.registerQueue(
        { name: QUEUE_M3U_IMPORT },
        { name: QUEUE_HEALTH_CHECK },
      ),
    ]
  : [];

const bullProviders = REDIS_URL
  ? [M3uImportConsumer, HealthCheckConsumer]
  : [];

@Module({
  imports: [PrismaModule, ...bullImports],
  controllers: [M3uImportController],
  providers: [
    M3uImportService,
    M3uParserService,
    StreamValidationService,
    ...bullProviders,
    HealthCheckScheduler,
    AutoCleanupScheduler,
  ],
  exports: [M3uImportService],
})
export class M3uImportModule {}
