import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsQueueConsumer } from './consumers/notifications.consumer';
import { EmailQueueConsumer } from './consumers/email.consumer';
import { AnalyticsQueueConsumer } from './consumers/analytics.consumer';

// Re-export from the dedicated constants file so existing importers of
// jobs.module.ts still resolve correctly, while the consumers themselves
// import directly from jobs.constants.ts (breaking the circular dependency).
export { QUEUE_NOTIFICATIONS, QUEUE_EMAIL, QUEUE_ANALYTICS } from './jobs.constants';
import { QUEUE_NOTIFICATIONS, QUEUE_EMAIL, QUEUE_ANALYTICS } from './jobs.constants';

const REDIS_URL = process.env['REDIS_URL'];

// BullMQ requires maxRetriesPerRequest:null + enableReadyCheck:false to prevent
// ioredis from emitting uncaught errors that crash the process when Redis is
// temporarily unreachable. lazyConnect:true defers the TCP handshake until the
// first command so a bad URL / wrong SSL config does NOT crash startup.
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
      BullModule.forRoot({
        connection: bullConnection,
        // Every queue inherits sensible retry semantics — without this BullMQ retries 0 times
        // and any transient failure (Redis blip, downstream 5xx) is silently dropped.
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 1000, age: 24 * 3600 },
          removeOnFail: { count: 5000, age: 7 * 24 * 3600 },
        },
      }),
      BullModule.registerQueue(
        { name: QUEUE_NOTIFICATIONS },
        { name: QUEUE_EMAIL },
        { name: QUEUE_ANALYTICS },
      ),
    ]
  : [];

const bullProviders = bullConnection
  ? [NotificationsQueueConsumer, EmailQueueConsumer, AnalyticsQueueConsumer]
  : [];

const bullExports = bullConnection ? [BullModule] : [];

@Module({
  imports: [PrismaModule, ...bullImports],
  providers: [...bullProviders],
  exports: [...bullExports],
})
export class JobsModule {}
