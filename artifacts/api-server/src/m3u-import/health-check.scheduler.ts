import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { M3uImportService, QUEUE_HEALTH_CHECK } from './m3u-import.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ChannelStreamStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthCheckScheduler {
  private readonly logger = new Logger(HealthCheckScheduler.name);
  private isRunning = false;

  constructor(
    private prisma: PrismaService,
    private importService: M3uImportService,
    @Optional() @InjectQueue(QUEUE_HEALTH_CHECK) private healthQueue: Queue | null,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS, {
    name: 'channel-health-check',
  })
  async handleScheduledHealthCheck() {
    if (this.isRunning) {
      this.logger.warn('Scheduled health check already running, skipping');
      return;
    }

    this.isRunning = true;
    try {
      this.logger.log('Starting scheduled 6-hour health check for all active channels');

      const channels = await this.prisma.channel.findMany({
        where: {
          deletedAt: null,
          primaryStreamUrl: { not: null },
          streamStatus: { in: [ChannelStreamStatus.active, ChannelStreamStatus.offline] },
        },
        select: { id: true },
        take: 5000,
      });

      if (channels.length === 0) {
        this.logger.log('No channels to check');
        return;
      }

      const channelIds = channels.map((c) => c.id);
      const BATCH_SIZE = 50;

      if (this.healthQueue) {
        // Queue in batches of 50 via Redis
        for (let i = 0; i < channelIds.length; i += BATCH_SIZE) {
          const batch = channelIds.slice(i, i + BATCH_SIZE);
          await this.healthQueue.add('check-channels', {
            channelIds: batch,
            offlineOnly: false,
          }, {
            attempts: 1,
            removeOnComplete: { count: 100 },
          });
        }
        this.logger.log(`Scheduled health check queued via Redis: ${channels.length} channels in ${Math.ceil(channels.length / BATCH_SIZE)} batches`);
      } else {
        // No Redis — delegate to service which runs in-process with setImmediate batches
        this.logger.warn('Redis unavailable — running scheduled health check in-process');
        await this.importService.triggerHealthCheck(channelIds);
        this.logger.log(`Scheduled health check dispatched in-process for ${channels.length} channels`);
      }
    } catch (err: any) {
      this.logger.error(`Scheduled health check failed: ${err?.message}`, err.stack);
    } finally {
      this.isRunning = false;
    }
  }
}