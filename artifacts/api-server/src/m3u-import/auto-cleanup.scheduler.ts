import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { M3uImportService } from './m3u-import.service';

@Injectable()
export class AutoCleanupScheduler {
  private readonly logger = new Logger(AutoCleanupScheduler.name);
  private isRunning = false;

  constructor(private importService: M3uImportService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'auto-cleanup-inactive-channels',
  })
  async handleDailyCleanup() {
    if (this.isRunning) {
      this.logger.warn('Auto-cleanup already running, skipping');
      return;
    }
    this.isRunning = true;
    try {
      this.logger.log('Starting daily auto-cleanup of inactive channels (7+ days)');
      const result = await this.importService.cleanupInactiveChannels();
      this.logger.log(`Auto-cleanup done: ${result.deleted} channels removed`);
    } catch (err: any) {
      this.logger.error(`Auto-cleanup failed: ${err?.message}`, err?.stack);
    } finally {
      this.isRunning = false;
    }
  }
}
