import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_ANALYTICS } from '../jobs.module';

export interface TrackEventJob {
  event: string;
  userId?: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

@Processor(QUEUE_ANALYTICS)
export class AnalyticsQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(AnalyticsQueueConsumer.name);

  async process(job: Job<TrackEventJob>): Promise<void> {
    this.logger.log(`Processing analytics event ${job.id}: ${job.data.event}`);
    await this.processEvent(job.data);
  }

  private async processEvent(data: TrackEventJob): Promise<void> {
    // TODO: Integrate an analytics backend (e.g. Mixpanel, Amplitude, PostHog, or custom DB writes).
    // Steps (PostHog example):
    //  1. Add dependency: pnpm add posthog-node
    //  2. Set env var: POSTHOG_API_KEY
    //  3. Initialize PostHog client in a shared AnalyticsModule
    //  4. Call posthog.capture({ distinctId: data.userId ?? 'anonymous', event: data.event, properties: data.properties })
    // Alternatively, write raw events to the AdEvent table in the DB for internal analytics.
    this.logger.warn(`[TODO] Analytics event not tracked — backend not configured. Event: "${data.event}", User: ${data.userId ?? 'anonymous'}`);
  }
}
