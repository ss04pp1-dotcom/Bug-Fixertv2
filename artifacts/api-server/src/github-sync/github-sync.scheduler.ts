import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubSyncService } from './github-sync.service';

@Injectable()
export class GitHubSyncScheduler {
  private readonly logger = new Logger(GitHubSyncScheduler.name);

  constructor(
    private prisma: PrismaService,
    private syncService: GitHubSyncService,
  ) {}

  @Cron('* * * * *', { name: 'github-sync-tick' })
  async tick(): Promise<void> {
    const now = new Date();

    const sources = await this.prisma.gitHubSource.findMany({
      where: { enabled: true, isSyncing: false },
      select: { id: true, name: true, syncIntervalMinutes: true, lastSyncAt: true },
    });

    for (const source of sources) {
      const intervalMs = source.syncIntervalMinutes * 60 * 1000;
      const lastSync = source.lastSyncAt?.getTime() ?? 0;
      const due = Date.now() - lastSync >= intervalMs;

      if (due) {
        this.logger.log(`Due sync: ${source.name}`);
        this.syncService.syncSource(source.id).catch(err =>
          this.logger.error(`Unhandled sync error for ${source.name}: ${err.message}`),
        );
      }
    }
  }
}
