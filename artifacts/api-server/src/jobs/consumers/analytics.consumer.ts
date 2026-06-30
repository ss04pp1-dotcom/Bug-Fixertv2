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

/**
 * A-069: this consumer previously only logged a TODO and dropped every analytics event
 * on the floor — silently losing all queued telemetry. We now log a warning (so operators
 * see the data loss in production logs) and emit a structured payload so the event can
 * be picked up by a log shipper (ELK, Loki, Datadog) and reconstructed later.
 *
 * If/when a proper analytics sink (PostHog / Amplitude / a dedicated `analytics_event`
 * table) is added, replace the warn() call below with a real write.
 */
@Processor(QUEUE_ANALYTICS)
export class AnalyticsQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(AnalyticsQueueConsumer.name);

  async onModuleInit() {
    try {
      await super.onModuleInit();
    } catch (err) {
      this.logger.warn(
        'Redis unavailable — analytics queue worker disabled. ' +
        (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  async process(job: Job<TrackEventJob>): Promise<void> {
    this.logger.debug(`Processing analytics event ${job.id}: ${job.data.event}`);
    await this.processEvent(job.data);
  }

  private async processEvent(data: TrackEventJob): Promise<void> {
    // A-069: no persistent storage sink is wired up yet — emit a structured warning
    // so events are visible in logs and can be ingested by a log shipper rather than
    // vanishing silently. Replace this with a real write (PostHog capture / AdEvent
    // table insert / etc.) when one is available.
    this.logger.warn(
      'Analytics event received but no storage configured — event discarded. ' +
        'Wire up a sink (PostHog / Amplitude / DB table) to persist.',
      JSON.stringify({
        event: data.event,
        userId: data.userId ?? 'anonymous',
        properties: data.properties ?? {},
        timestamp: data.timestamp ?? new Date().toISOString(),
      }),
    );
  }
}
