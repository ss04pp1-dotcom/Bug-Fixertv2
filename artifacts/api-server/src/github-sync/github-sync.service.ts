import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubSyncStatus, ServerSourceType } from '@prisma/client';
import { M3uParser } from './parsers/m3u.parser';
import { JsonParser } from './parsers/json.parser';
import { ParsedChannel } from './parsers/parser.interface';

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ')
    .trim();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

function uniqueSlug(base: string, existing: Set<string>): string {
  let slug = base;
  let n = 1;
  while (existing.has(slug)) slug = `${base}-${n++}`;
  existing.add(slug);
  return slug;
}

interface ExistingServer {
  id: string;
  channelId: string;
  link: string;
  githubChannelId: string | null;
}

@Injectable()
export class GitHubSyncService {
  private readonly logger = new Logger(GitHubSyncService.name);
  private readonly parsers = [new JsonParser(), new M3uParser()];

  constructor(private prisma: PrismaService) {}

  async syncSource(sourceId: string): Promise<void> {
    const source = await this.prisma.gitHubSource.findUnique({ where: { id: sourceId } });
    if (!source) return;

    // ── Sync lock ─────────────────────────────────────────────────────────────
    if (source.isSyncing) {
      const staleMs = 10 * 60 * 1000;
      if (source.syncStartedAt && Date.now() - source.syncStartedAt.getTime() < staleMs) {
        this.logger.warn(`Source ${source.name} already syncing — skipping`);
        return;
      }
    }

    await this.prisma.gitHubSource.update({
      where: { id: sourceId },
      data: { isSyncing: true, syncStartedAt: new Date() },
    });

    const logEntry = await this.prisma.gitHubSyncLog.create({
      data: { githubSourceId: sourceId, startedAt: new Date(), status: GitHubSyncStatus.running },
    });

    const stats = { added: 0, updated: 0, deleted: 0, failed: 0, totalParsed: 0 };
    const startedAt = Date.now();

    try {
      const { content, etag, lastModified, unchanged } = await this.fetchContent(
        source.url,
        source.etag ?? undefined,
        source.lastModified ?? undefined,
      );

      await this.prisma.gitHubSource.update({
        where: { id: sourceId },
        data: { lastFetchedAt: new Date(), etag: etag ?? null, lastModified: lastModified ?? null },
      });

      if (unchanged) {
        this.logger.log(`Source ${source.name}: unchanged (ETag hit)`);
        await this.finalize(sourceId, logEntry.id, GitHubSyncStatus.success, stats, startedAt, 'Content unchanged');
        return;
      }

      const parsed = this.detectAndParse(content, source.url);
      stats.totalParsed = parsed.length;
      this.logger.log(`Source ${source.name}: parsed ${parsed.length} channels`);

      await this.applyChanges(sourceId, parsed, stats);
      await this.updateSourceCounts(sourceId);
      await this.finalize(sourceId, logEntry.id, GitHubSyncStatus.success, stats, startedAt);

    } catch (err: any) {
      this.logger.error(`Sync failed for ${source.name}: ${err.message}`);
      await this.finalize(sourceId, logEntry.id, GitHubSyncStatus.failed, stats, startedAt, err.message);
      await this.prisma.gitHubSource.update({
        where: { id: sourceId },
        data: { consecutiveFailures: { increment: 1 } },
      });
    }
  }

  // ── Fetch with ETag caching ────────────────────────────────────────────────

  private async fetchContent(
    url: string,
    etag?: string,
    lastModified?: string,
  ): Promise<{ content: string; etag?: string; lastModified?: string; unchanged: boolean }> {
    const headers: Record<string, string> = {
      'User-Agent': 'StreamPro-Sync/1.0',
      'Accept': 'text/plain,application/json,*/*',
    };
    if (etag) headers['If-None-Match'] = etag;
    if (lastModified) headers['If-Modified-Since'] = lastModified;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (res.status === 304) return { content: '', etag, lastModified, unchanged: true };
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const content = await res.text();
      return {
        content,
        etag: res.headers.get('etag') ?? undefined,
        lastModified: res.headers.get('last-modified') ?? undefined,
        unchanged: false,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Parser selection ───────────────────────────────────────────────────────

  private detectAndParse(content: string, url: string): ParsedChannel[] {
    for (const parser of this.parsers) {
      if (parser.canParse(content, url)) return parser.parse(content);
    }
    throw new Error('No parser could handle the content format');
  }

  // ── Core upsert/delete logic ───────────────────────────────────────────────

  private async applyChanges(
    sourceId: string,
    parsed: ParsedChannel[],
    stats: { added: number; updated: number; deleted: number; failed: number },
  ): Promise<void> {
    // All active servers from this source (used for soft-delete of removed entries)
    const existingServers: ExistingServer[] = await this.prisma.channelServer.findMany({
      where: { githubSourceId: sourceId, deletedAt: null },
      select: { id: true, channelId: true, link: true, githubChannelId: true },
    });

    const seenServerIds = new Set<string>();

    // Build dedup maps from all channels
    const allChannels = await this.prisma.channel.findMany({
      where: { deletedAt: null },
      select: { id: true, normalizedName: true, githubChannelId: true, slug: true },
    });
    const byNorm = new Map<string, string>();
    const byGhId = new Map<string, string>();
    const slugSet = new Set<string>(allChannels.map(c => c.slug));
    for (const ch of allChannels) {
      if (ch.normalizedName) byNorm.set(ch.normalizedName, ch.id);
      if (ch.githubChannelId) byGhId.set(ch.githubChannelId, ch.id);
    }

    // Process in batches of 100 items, each batch in a transaction
    const BATCH = 100;
    for (let i = 0; i < parsed.length; i += BATCH) {
      await this.processBatch(
        parsed.slice(i, i + BATCH),
        sourceId,
        existingServers,
        seenServerIds,
        byNorm,
        byGhId,
        slugSet,
        stats,
      );
    }

    // Soft-delete servers from this source that were NOT in latest fetch
    const staleIds = existingServers
      .filter(s => !seenServerIds.has(s.id))
      .map(s => s.id);

    if (staleIds.length > 0) {
      await this.prisma.channelServer.updateMany({
        where: { id: { in: staleIds } },
        data: { deletedAt: new Date() },
      });
      stats.deleted += staleIds.length;
      await this.cleanupOrphanChannels(staleIds);
    }
  }

  private async processBatch(
    batch: ParsedChannel[],
    sourceId: string,
    existingServers: ExistingServer[],
    seenServerIds: Set<string>,
    byNorm: Map<string, string>,
    byGhId: Map<string, string>,
    slugSet: Set<string>,
    stats: { added: number; updated: number; deleted: number; failed: number },
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const item of batch) {
        try {
          const normalized = normalizeName(item.name);

          // Resolve channel: githubChannelId → normalizedName → create
          let channelId: string | undefined =
            (item.githubChannelId ? byGhId.get(item.githubChannelId) : undefined) ??
            byNorm.get(normalized);

          if (!channelId) {
            const slug = uniqueSlug(slugify(item.name), slugSet);
            const created = await tx.channel.create({
              data: {
                name: item.name,
                slug,
                normalizedName: normalized,
                githubChannelId: item.githubChannelId ?? null,
                logo: item.logo ?? null,
                primaryStreamUrl: item.link,
                isActive: true,
              },
              select: { id: true },
            });
            channelId = created.id;
            byNorm.set(normalized, channelId);
            if (item.githubChannelId) byGhId.set(item.githubChannelId, channelId);
            stats.added++;
          } else {
            // Update logo only if no admin override
            const ch = await tx.channel.findUnique({
              where: { id: channelId },
              select: { adminLogoOverride: true },
            });
            const updateData: Record<string, unknown> = { normalizedName: normalized };
            if (item.logo && !ch?.adminLogoOverride) updateData.logo = item.logo;
            await tx.channel.update({ where: { id: channelId }, data: updateData });
          }

          // Find existing server for this source + channel (by githubChannelId or channelId)
          const existingServer =
            (item.githubChannelId
              ? existingServers.find(s => s.githubChannelId === item.githubChannelId)
              : undefined) ??
            existingServers.find(s => s.channelId === channelId);

          if (existingServer) {
            await tx.channelServer.update({
              where: { id: existingServer.id },
              data: {
                channelId,
                link: item.link,
                cookie: item.cookie ?? null,
                userAgent: item.userAgent ?? null,
                referer: item.referer ?? null,
                origin: item.origin ?? null,
                lastSeenAt: new Date(),
                deletedAt: null,
                enabled: true,
              },
            });
            seenServerIds.add(existingServer.id);
            stats.updated++;
          } else {
            const newServer = await tx.channelServer.create({
              data: {
                channelId,
                link: item.link,
                cookie: item.cookie ?? null,
                userAgent: item.userAgent ?? null,
                referer: item.referer ?? null,
                origin: item.origin ?? null,
                priority: 100,
                sourceType: ServerSourceType.GITHUB,
                githubSourceId: sourceId,
                githubChannelId: item.githubChannelId ?? null,
                healthCheckEnabled: false,
                createdBySync: true,
                lastSeenAt: new Date(),
                enabled: true,
              },
              select: { id: true },
            });
            seenServerIds.add(newServer.id);
            existingServers.push({
              id: newServer.id,
              channelId,
              link: item.link,
              githubChannelId: item.githubChannelId ?? null,
            });
            stats.updated++;
          }
        } catch (e: any) {
          this.logger.warn(`Failed to process "${item.name}": ${e.message}`);
          stats.failed++;
        }
      }
    });
  }

  private async cleanupOrphanChannels(deletedServerIds: string[]): Promise<void> {
    const deleted = await this.prisma.channelServer.findMany({
      where: { id: { in: deletedServerIds } },
      select: { channelId: true },
    });
    const channelIds = [...new Set(deleted.map(s => s.channelId))];

    for (const channelId of channelIds) {
      const [activeCount, adminCount] = await Promise.all([
        this.prisma.channelServer.count({ where: { channelId, deletedAt: null, enabled: true } }),
        this.prisma.channelServer.count({ where: { channelId, sourceType: ServerSourceType.ADMIN, deletedAt: null } }),
      ]);
      if (activeCount === 0 && adminCount === 0) {
        await this.prisma.channel.update({ where: { id: channelId }, data: { deletedAt: new Date() } });
      }
    }
  }

  private async updateSourceCounts(sourceId: string): Promise<void> {
    const [serverCount, channelGroups] = await Promise.all([
      this.prisma.channelServer.count({ where: { githubSourceId: sourceId, deletedAt: null, enabled: true } }),
      this.prisma.channelServer.groupBy({
        by: ['channelId'],
        where: { githubSourceId: sourceId, deletedAt: null, enabled: true },
      }),
    ]);
    await this.prisma.gitHubSource.update({
      where: { id: sourceId },
      data: { channelCount: channelGroups.length, serverCount },
    });
  }

  private async finalize(
    sourceId: string,
    logId: string,
    status: GitHubSyncStatus,
    stats: { added: number; updated: number; deleted: number; failed: number; totalParsed: number },
    startedAt: number,
    message?: string,
  ): Promise<void> {
    const durationMs = Date.now() - startedAt;
    const now = new Date();
    await Promise.all([
      this.prisma.gitHubSyncLog.update({
        where: { id: logId },
        data: {
          endedAt: now, durationMs, status,
          added: stats.added, updated: stats.updated,
          deleted: stats.deleted, failed: stats.failed,
          totalParsed: stats.totalParsed,
          errorMessage: message ?? null,
        },
      }),
      this.prisma.gitHubSource.update({
        where: { id: sourceId },
        data: {
          isSyncing: false, syncStartedAt: null,
          lastSyncAt: now, lastSyncStatus: status,
          lastSyncMessage: message ?? null,
          ...(status === GitHubSyncStatus.success
            ? { lastSuccessfulSyncAt: now, consecutiveFailures: 0 }
            : {}),
        },
      }),
    ]);
  }
}
