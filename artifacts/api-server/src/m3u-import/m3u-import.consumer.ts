import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { M3uImportService } from './m3u-import.service';

@Processor('m3u-import')
export class M3uImportConsumer extends WorkerHost {
  private readonly logger = new Logger(M3uImportConsumer.name);

  constructor(private importService: M3uImportService) {
    super();
  }

  async process(job: Job<{ importJobId: string; filePath: string }>): Promise<void> {
    this.logger.log(`Processing import job ${job.id} → importJobId=${job.data.importJobId}`);
    await this.importService.processImportJob(job.data.importJobId, job.data.filePath);
    this.logger.log(`Import job ${job.id} completed`);
  }
}