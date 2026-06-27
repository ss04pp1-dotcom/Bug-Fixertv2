import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubSyncService } from './github-sync.service';

// Bump this version whenever the M3U/playlist parser changes in a way that
// extracts new fields (cookie, userAgent, referer, origin, etc.).
// On startup the scheduler compares this against the DB-stored value and
// auto-forces a full re-sync of every source if they differ.
const PARSER_VERSION = 2;
const PARSER_VERSION_KEY = 'github_sync_parser_version';

@Injectable()
export class GitHubSyncScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(GitHubSyncScheduler.name);

  constructor(
    private prisma: PrismaService,
    private syncService: GitHubSyncService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: PARSER_VERSION_KEY },
      });
      const storedVersion = setting ? parseInt(setting.value as string, 10) : 0;

      if (storedVersion < PARSER_VERSION) {
        this.logger.log(
          `Parser version changed (${storedVersion} → ${PARSER_VERSION}). ` +
          'Clearing ETags on all sources so next sync re-parses cookies/UA.',
        );
        await this.prisma.gitHubSource.updateMany({
          where: { enabled: true },
          data: { etag: null, lastModified: null },
        });
        await this.prisma.setting.upsert({
          where: { key: PARSER_VERSION_KEY },
          create: { key: PARSER_VERSION_KEY, value: String(PARSER_VERSION) },
          update: { value: String(PARSER_VERSION) },
        });
        this.logger.log('ETag cache cleared — all sources will be force-synced on the next tick.');
      }
    } catch (err: any) {
      this.logger.warn(`Parser-version check failed (non-fatal): ${err?.message}`);
    }
  }

  @Cron('* * * * *', { name: 'github-sync-tick' })
  async tick(): Promise<void> {
    // Startup deduplication must complete before any sync runs.
    if (!this.syncService.isDedupReady()) {
      this.logger.log('Startup deduplication not yet complete — skipping sync tick');
      return;
    }

    const sources = await this.prisma.gitHubSource.findMany({
      where: { enabled: true, isSyncing: false },
      select: { id: true, name: true, syncIntervalMinutes: true, lastSyncAt: true },
    });

    for (const source of sources) {
      const intervalMs = source.syncIntervalMinutes * 60 * 1000;
      const lastSync = source.lastSyncAt?.getTime() ?? 0;
      const due = Date.now() - lastSync >= intervalMs;

      if (due) {
        this.logger.log(`Due sync (force): ${source.name}`);

        // Always force-sync on schedule: clear ETag so content is always
        // re-fetched and re-processed regardless of whether the remote file
        // has changed. This ensures stream URLs stay fresh even when the
        // GitHub file itself reports as unchanged via ETag/Last-Modified.
        try {
          await this.prisma.gitHubSource.update({
            where: { id: source.id },
            data: { etag: null, lastModified: null },
          });
        } catch (err: any) {
          this.logger.warn(`Could not clear ETag for ${source.name}: ${err?.message}`);
        }

        this.syncService.syncSource(source.id).catch(err =>
          this.logger.error(`Unhandled sync error for ${source.name}: ${err.message}`),
        );
      }
    }
  }
}
