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

    // Include sources that are either:
    //  (a) not currently syncing, OR
    //  (b) syncing but with a stale lock (started > 10 min ago — process likely crashed).
    // Without (b), a crashed mid-sync source is permanently skipped until server restart.
    const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);
    const sources = await this.prisma.gitHubSource.findMany({
      where: {
        enabled: true,
        OR: [
          { isSyncing: false },
          { isSyncing: true, syncStartedAt: { lt: staleCutoff } },
        ],
      },
      select: { id: true, name: true, syncIntervalMinutes: true, lastSyncAt: true },
    });

    for (const source of sources) {
      // Guard against 0 / null interval values that would create a NaN or tight-loop.
      const intervalMinutes = Math.max(1, source.syncIntervalMinutes ?? 10);
      const intervalMs = intervalMinutes * 60 * 1000;
      const lastSync = source.lastSyncAt?.getTime() ?? 0;
      const due = Date.now() - lastSync >= intervalMs;

      if (due) {
        this.logger.log(`Due sync: ${source.name}`);
        // ETag is always cleared inside syncSource itself — no need to do it here.
        this.syncService.syncSource(source.id).catch(err =>
          this.logger.error(`Unhandled sync error for ${source.name}: ${err.message}`),
        );
      }
    }
  }

  /**
   * Daily stale-server cleanup — runs at 02:00 every night.
   *
   * Soft-deletes GitHub-managed ChannelServer rows that have not appeared in
   * any sync for 48+ hours (meaning the source file no longer contains them).
   * Channels that lose ALL their active servers across every source are then
   * also soft-deleted (orphan cleanup).  Channels that still have servers from
   * another source or admin are kept — only the stale GitHub server is removed.
   */
  @Cron('0 2 * * *', { name: 'stale-server-cleanup' })
  async cleanupStaleServers(): Promise<void> {
    this.logger.log('Running nightly stale-server cleanup…');
    try {
      await this.syncService.cleanupStaleGithubServers();
    } catch (err: any) {
      this.logger.error(`Stale-server cleanup failed: ${err.message}`, err.stack);
    }
  }
}
