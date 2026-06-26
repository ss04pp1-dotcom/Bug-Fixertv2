import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { M3uImportService } from './m3u-import.service';

@Processor('health-check')
export class HealthCheckConsumer extends WorkerHost {
  private readonly logger = new Logger(HealthCheckConsumer.name);

  constructor(private importService: M3uImportService) {
    super();
  }

  async process(job: Job<{ channelIds: string[]; offlineOnly?: boolean }>): Promise<void> {
    this.logger.log(`Health check job ${job.id}: ${job.data.channelIds.length} channels`);
    await this.importService.processHealthCheck(job.data.channelIds);
    this.logger.log(`Health check job ${job.id} completed`);
  }
}