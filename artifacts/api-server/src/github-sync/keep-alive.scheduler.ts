import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Server-side keep-alive scheduler.
 *
 * Problem: Render free-tier instances sleep after 15 minutes of inactivity.
 * When the server sleeps, @nestjs/schedule cron jobs stop running, so the
 * GitHub-sync ticks are never fired — even if the interval has elapsed.
 *
 * Solution: This scheduler pings the server's OWN /healthz endpoint every
 * 10 minutes. That HTTP request counts as "activity" in Render's eyes, so the
 * server never crosses the 15-minute idle threshold and stays awake permanently.
 *
 * Requirements:
 *   APP_URL env var must be set to the full public URL of this server,
 *   e.g.  https://livetv-6bpg.onrender.com
 *   If APP_URL is not set, self-ping is skipped (logs a one-time warning).
 *
 * The feature is controlled by the `keep_alive_enabled` Setting key in the DB.
 * Default: enabled (protects operators who haven't explicitly turned it off).
 */
@Injectable()
export class KeepAliveScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(KeepAliveScheduler.name);
  private selfUrl: string | null = null;
  private warnedMissingUrl = false;
  private enabled = true;

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const raw = (process.env['APP_URL'] ?? '').replace(/\/+$/, '');
    this.selfUrl = raw || null;

    if (!this.selfUrl) {
      this.logger.warn(
        'APP_URL env var is not set — server self-ping keep-alive is disabled. ' +
        'Set APP_URL to the public Render URL (e.g. https://myapp.onrender.com) ' +
        'to prevent the server from sleeping.',
      );
    } else {
      this.logger.log(`Keep-alive self-ping ready → ${this.selfUrl}/healthz (every 10 min)`);
    }

    // Perform an immediate ping on startup to register activity with Render
    await this.ping();
  }

  /**
   * Runs every 10 minutes — safely inside the 15-minute Render inactivity window.
   * Also refreshes the keep_alive_enabled setting from the DB on each tick so
   * changes in Admin → Settings take effect without a server restart.
   */
  @Cron('*/10 * * * *', { name: 'keep-alive-ping' })
  async tick(): Promise<void> {
    // Re-read setting on every tick so admin toggle is respected promptly
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'keep_alive_enabled' },
      });
      this.enabled = setting ? String(setting.value) !== 'false' : true;
    } catch {
      // Non-fatal: keep previous value if DB is temporarily unreachable
    }

    if (!this.enabled) {
      this.logger.debug('Keep-alive disabled via setting — skipping ping');
      return;
    }

    await this.ping();
  }

  private async ping(): Promise<void> {
    if (!this.selfUrl) {
      if (!this.warnedMissingUrl) {
        this.warnedMissingUrl = true;
        this.logger.warn('Keep-alive ping skipped: APP_URL not configured');
      }
      return;
    }

    const url = `${this.selfUrl}/healthz`;
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'User-Agent': 'StreamPro-KeepAlive/1.0', 'Cache-Control': 'no-store' },
      });
      clearTimeout(timer);
      this.logger.log(
        `Self-ping OK → ${url} [${res.status}] in ${Date.now() - start}ms`,
      );
    } catch (err: any) {
      this.logger.warn(`Self-ping failed → ${url}: ${err?.message ?? err}`);
    }
  }
}
