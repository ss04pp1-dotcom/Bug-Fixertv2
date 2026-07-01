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

// M3uImportModule is self-contained: it registers its own BullModule.forRoot
// so it never races against JobsModule's global forRoot during NestJS module
// initialisation. Both forRoot calls share the same ioredis options.
const bullConnection = REDIS_URL
  ? {
      url: REDIS_URL,
      maxRetriesPerRequest: null as unknown as number,
      enableReadyCheck: false,
      lazyConnect: true,
    }
  : undefined;

const bullImports = bullConnection
  ? [
      BullModule.forRoot({ connection: bullConnection }),
      BullModule.registerQueue(
        { name: QUEUE_M3U_IMPORT },
        { name: QUEUE_HEALTH_CHECK },
      ),
    ]
  : [];

const bullProviders = bullConnection
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
