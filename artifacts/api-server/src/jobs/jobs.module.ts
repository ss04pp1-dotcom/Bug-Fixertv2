import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsQueueConsumer } from './consumers/notifications.consumer';
import { EmailQueueConsumer } from './consumers/email.consumer';
import { AnalyticsQueueConsumer } from './consumers/analytics.consumer';

export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_EMAIL = 'email';
export const QUEUE_ANALYTICS = 'analytics';

const REDIS_URL = process.env['REDIS_URL'];

const bullImports = REDIS_URL
  ? [
      BullModule.forRoot({ connection: { url: REDIS_URL } }),
      BullModule.registerQueue(
        { name: QUEUE_NOTIFICATIONS },
        { name: QUEUE_EMAIL },
        { name: QUEUE_ANALYTICS },
      ),
    ]
  : [];

const bullProviders = REDIS_URL
  ? [NotificationsQueueConsumer, EmailQueueConsumer, AnalyticsQueueConsumer]
  : [];

const bullExports = REDIS_URL ? [BullModule] : [];

@Module({
  imports: [...bullImports],
  providers: [...bullProviders],
  exports: [...bullExports],
})
export class JobsModule {}
