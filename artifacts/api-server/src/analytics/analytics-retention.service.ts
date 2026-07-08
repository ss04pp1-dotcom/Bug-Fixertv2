import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Purge old analytics_events + related high-write tables on a schedule so tables
 * don't grow unbounded. Retention windows are env-driven for safe tuning.
 *
 * Retention env vars (days, defaults in parens):
 *   ANALYTICS_EVENT_RETENTION_DAYS (90)
 *   PLAYBACK_EVENT_RETENTION_DAYS  (60)
 *   AUDIT_LOG_RETENTION_DAYS       (365)
 */
@Injectable()
export class AnalyticsRetentionService {
  private readonly logger = new Logger(AnalyticsRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Every day at 03:15 server time — off-peak window.
  @Cron('15 3 * * *', { name: 'analytics-retention', timeZone: 'UTC' })
  async purge(): Promise<void> {
    const now = Date.now();
    const days = (key: string, def: number) => {
      const v = Number(process.env[key]);
      return Number.isFinite(v) && v > 0 ? v : def;
    };

    const analyticsCutoff = new Date(now - days('ANALYTICS_EVENT_RETENTION_DAYS', 90) * 86_400_000);
    const playbackCutoff = new Date(now - days('PLAYBACK_EVENT_RETENTION_DAYS', 60) * 86_400_000);
    const auditCutoff = new Date(now - days('AUDIT_LOG_RETENTION_DAYS', 365) * 86_400_000);

    try {
      const [ae, pe, al] = await Promise.all([
        // Wrapped in try/catch each — a missing model shouldn't stop the whole purge.
        this.safeDelete('analyticsEvent', { createdAt: { lt: analyticsCutoff } }),
        this.safeDelete('playbackEvent', { createdAt: { lt: playbackCutoff } }),
        this.safeDelete('auditLog', { createdAt: { lt: auditCutoff } }),
      ]);
      this.logger.log(
        `Retention purge complete — analyticsEvent: ${ae}, playbackEvent: ${pe}, auditLog: ${al}`,
      );
    } catch (err) {
      this.logger.error('Retention purge failed', err instanceof Error ? err.stack : String(err));
    }
  }

  // Purge expired sessions (Session.expiresAt < now). Frees rows tied to refresh tokens.
  @Cron(CronExpression.EVERY_HOUR, { name: 'expired-session-cleanup' })
  async purgeExpiredSessions(): Promise<void> {
    const count = await this.safeDelete('session', { expiresAt: { lt: new Date() } });
    if (count > 0) this.logger.log(`Purged ${count} expired sessions`);
  }

  // Purge consumed / expired OTPs older than 24h.
  @Cron(CronExpression.EVERY_HOUR, { name: 'expired-otp-cleanup' })
  async purgeExpiredOtps(): Promise<void> {
    const cutoff = new Date(Date.now() - 86_400_000);
    const count = await this.safeDelete('otp', { expiresAt: { lt: cutoff } });
    if (count > 0) this.logger.log(`Purged ${count} expired OTPs`);
  }

  // ─── AdEvent retention ──────────────────────────────────────────────────────
  // AdEvents accumulate at impression-rate (one row per banner load/click).
  // 90-day default keeps ~3 months of revenue attribution data.
  @Cron('30 3 * * *', { name: 'ad-event-retention', timeZone: 'UTC' })
  async purgeAdEvents(): Promise<void> {
    const days = (key: string, def: number) => {
      const v = Number(process.env[key]);
      return Number.isFinite(v) && v > 0 ? v : def;
    };
    const cutoff = new Date(Date.now() - days('AD_EVENT_RETENTION_DAYS', 90) * 86_400_000);
    const count = await this.safeDelete('adEvent', { createdAt: { lt: cutoff } });
    if (count > 0) this.logger.log(`Purged ${count} old AdEvents (cutoff: ${cutoff.toISOString()})`);
  }

  // ─── WatchHistory retention ───────────────────────────────────────────────
  // Keep recent watch-history for recommendations; purge stale rows to prevent
  // unbounded growth (upsert-on-unique keeps the table compact but old sessions
  // with deleted content leave orphan rows).
  @Cron('0 4 * * *', { name: 'watch-history-retention', timeZone: 'UTC' })
  async purgeStaleWatchHistory(): Promise<void> {
    const days = (key: string, def: number) => {
      const v = Number(process.env[key]);
      return Number.isFinite(v) && v > 0 ? v : def;
    };
    const cutoff = new Date(Date.now() - days('WATCH_HISTORY_RETENTION_DAYS', 180) * 86_400_000);
    const count = await this.safeDelete('watchHistory', { watchedAt: { lt: cutoff } });
    if (count > 0) this.logger.log(`Purged ${count} stale WatchHistory rows (cutoff: ${cutoff.toISOString()})`);
  }

  // ─── SearchHistory retention ─────────────────────────────────────────────
  // SearchHistory grows with every upserted query string. 30-day window keeps
  // trending-search time-series while discarding ancient data.
  @Cron('15 4 * * *', { name: 'search-history-retention', timeZone: 'UTC' })
  async purgeSearchHistory(): Promise<void> {
    const days = (key: string, def: number) => {
      const v = Number(process.env[key]);
      return Number.isFinite(v) && v > 0 ? v : def;
    };
    const cutoff = new Date(Date.now() - days('SEARCH_HISTORY_RETENTION_DAYS', 30) * 86_400_000);
    const count = await this.safeDelete('searchHistory', { createdAt: { lt: cutoff } });
    if (count > 0) this.logger.log(`Purged ${count} old SearchHistory rows (cutoff: ${cutoff.toISOString()})`);
  }

  private async safeDelete(model: string, where: Record<string, unknown>): Promise<number> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = (this.prisma as any)[model];
      if (!client?.deleteMany) return 0;
      const res = await client.deleteMany({ where });
      return res.count ?? 0;
    } catch (err) {
      this.logger.warn(
        `safeDelete(${model}) skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 0;
    }
  }
}
