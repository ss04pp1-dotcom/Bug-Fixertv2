import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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
      BullModule.forRoot({ connection: bullConnection }),
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
  imports: [...bullImports],
  providers: [...bullProviders],
  exports: [...bullExports],
})
export class JobsModule {}
