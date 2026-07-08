import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_ANALYTICS } from '../jobs.constants';
import { PrismaService } from '../../prisma/prisma.service';

export interface TrackEventJob {
  event: string;
  userId?: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

/**
 * A-069 (fixed): analytics events are now persisted to the `analytics_events`
 * table so they survive process restarts and can be aggregated for dashboards.
 * If a third-party sink (PostHog / Amplitude) is added later, publish from
 * here as well — the DB row acts as a durable buffer.
 */
@Processor(QUEUE_ANALYTICS)
export class AnalyticsQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(AnalyticsQueueConsumer.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<TrackEventJob>): Promise<void> {
    this.logger.debug(`Processing analytics event ${job.id}: ${job.data.event}`);
    await this.processEvent(job.data);
  }

  private async processEvent(data: TrackEventJob): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          event: data.event,
          userId: data.userId ?? null,
          properties: (data.properties ?? {}) as any,
          occurredAt: data.timestamp ? new Date(data.timestamp) : new Date(),
        },
      });
    } catch (err) {
      // Never crash the worker — analytics is best-effort. Log so operators
      // can see when writes start failing (bad payload, DB down, etc.).
      this.logger.error(
        `Failed to persist analytics event ${data.event}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
