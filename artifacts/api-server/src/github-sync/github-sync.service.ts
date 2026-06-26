import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubSyncStatus, ServerSourceType } from '@prisma/client';
import { M3uParser } from './parsers/m3u.parser';
import { JsonParser } from './parsers/json.parser';
import { ParsedChannel } from './parsers/parser.interface';

/**
 * Normalise a channel name for deduplication.
 * Collapses whitespace, hyphens, underscores and dots into a single space
 * so that "Sony HD", "SONY HD", "Sony-HD", "Sony_HD" and "Sony.HD" all
 * produce the same key: "sony hd".
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s\-_\.]+/g, ' ')
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

/** Prisma error code for a unique-constraint violation */
const P2002 = 'P2002';

interface ExistingServer {
  id: string;
  channelId: string;
  link: string;
  githubChannelId: string | null;
}

@Injectable()
export class GitHubSyncService implements OnModuleInit {
  private readonly logger = new Logger(GitHubSyncService.name);
  private readonly parsers = [new JsonParser(), new M3uParser()];

  constructor(private prisma: PrismaService) {}

  // ── Startup: clean up any existing duplicate channels ─────────────────────

  async onModuleInit(): Promise<void> {
    await this.deduplicateExistingChannels();
  }

  /**
   * Merges any Channel rows that share the same normalizedName (idempotent).
   * Keeps the oldest row, reassigns all ChannelServer rows to it, and
   * soft-deletes the duplicates. Must run before the @@unique constraint
   * is enforced so that stale duplicates don't block schema pushes.
   */
  async deduplicateExistingChannels(): Promise<void> {
    const dupeGroups = await this.prisma.$queryRaw<
      { normalizedName: string; ids: string[] }[]
    >`
      SELECT
        normalized_name        AS "normalizedName",
        array_agg(id::text ORDER BY created_at ASC) AS ids
      FROM channels
      WHERE normalized_name IS NOT NULL
        AND deleted_at IS NULL
      GROUP BY normalized_name
      HAVING count(*) > 1
    `;

    if (dupeGroups.length === 0) return;

    this.logger.warn(
      `deduplicateExistingChannels: ${dupeGroups.length} duplicate group(s) found — merging…`,
    );

    for (const group of dupeGroups) {
      const [keepId, ...removeIds] = group.ids;

      // Re-assign servers from duplicate channels to the keeper
      await this.prisma.channelServer.updateMany({
        where: { channelId: { in: removeIds } },
        data: { channelId: keepId },
      });

      // Re-assign playback events
      await this.prisma.$executeRaw`
        UPDATE playback_events
        SET channel_id = ${keepId}::uuid
        WHERE channel_id = ANY(${removeIds}::uuid[])
      `;

      // Re-assign EPG programs
      await this.prisma.$executeRaw`
        UPDATE epg_programs
        SET channel_id = ${keepId}::uuid
        WHERE channel_id = ANY(${removeIds}::uuid[])
      `;

      // Re-assign favorites — drop any that would collide with an existing
      // favorite for the keeper, then reassign the rest.
      await this.prisma.$executeRaw`
        DELETE FROM favorites
        WHERE channel_id = ANY(${removeIds}::uuid[])
          AND EXISTS (
            SELECT 1 FROM favorites f2
            WHERE f2.user_id = favorites.user_id
              AND f2.channel_id = ${keepId}::uuid
          )
      `;
      await this.prisma.$executeRaw`
        UPDATE favorites
        SET channel_id = ${keepId}::uuid
        WHERE channel_id = ANY(${removeIds}::uuid[])
      `;

      // Soft-delete the duplicate rows
      await this.prisma.channel.updateMany({
        where: { id: { in: removeIds } },
        data: { deletedAt: new Date() },
      });

      this.logger.log(`Merged ${removeIds.length} duplicate(s) → kept channel ${keepId}`);
    }
  }

  // ── Public sync entry point ────────────────────────────────────────────────

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
    // Active servers from this source (used for soft-delete of removed entries)
    const existingServers: ExistingServer[] = await this.prisma.channelServer.findMany({
      where: { githubSourceId: sourceId, deletedAt: null },
      select: { id: true, channelId: true, link: true, githubChannelId: true },
    });

    const seenServerIds = new Set<string>();

    // Build in-memory dedup maps from the current DB snapshot.
    // These are updated after each successful channel create so later items
    // in the same sync don't trigger redundant DB lookups.
    const allChannels = await this.prisma.channel.findMany({
      where: { deletedAt: null },
      select: { id: true, normalizedName: true, githubChannelId: true, slug: true },
    });
    const byNorm = new Map<string, string>();   // normalizedName → channelId
    const byGhId = new Map<string, string>();   // githubChannelId → channelId
    const slugSet = new Set<string>(allChannels.map(c => c.slug));
    for (const ch of allChannels) {
      if (ch.normalizedName) byNorm.set(ch.normalizedName, ch.id);
      if (ch.githubChannelId) byGhId.set(ch.githubChannelId, ch.id);
    }

    // Process in batches of 100 items
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

  /**
   * Process a slice of parsed channels.
   *
   * Each item is handled individually (no shared batch transaction) so that a
   * failure or unique-constraint race on one item does not roll back the others.
   */
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
    for (const item of batch) {
      try {
        await this.processItem(
          item, sourceId, existingServers, seenServerIds, byNorm, byGhId, slugSet, stats,
        );
      } catch (e: any) {
        this.logger.warn(`Failed to process "${item.name}": ${e.message}`);
        stats.failed++;
      }
    }
  }

  /**
   * Resolve (or create) the Channel and ChannelServer records for one parsed entry.
   *
   * Channel deduplication order:
   *   1. githubChannelId match in the in-memory map   (same tvg-id)
   *   2. normalizedName  match in the in-memory map   (within this sync)
   *   3. normalizedName  match re-queried from the DB  (concurrent sync created it)
   *   4. INSERT with catch of P2002 + re-fetch         (true race condition)
   *
   * Server deduplication (per source):
   *   Match by githubChannelId first, then by channelId + exact link.
   *   This lets the same source supply multiple distinct URLs for the same
   *   channel — each URL becomes its own ChannelServer row.
   */
  private async processItem(
    item: ParsedChannel,
    sourceId: string,
    existingServers: ExistingServer[],
    seenServerIds: Set<string>,
    byNorm: Map<string, string>,
    byGhId: Map<string, string>,
    slugSet: Set<string>,
    stats: { added: number; updated: number; deleted: number; failed: number },
  ): Promise<void> {
    const normalized = normalizeName(item.name);
    if (!normalized) return;

    // ── 1. Resolve Channel ───────────────────────────────────────────────────

    let channelId: string | undefined =
      (item.githubChannelId ? byGhId.get(item.githubChannelId) : undefined) ??
      byNorm.get(normalized);

    if (!channelId) {
      // Maps were built before the sync started; another concurrent sync for a
      // different source may have created this channel since then — check the DB.
      const existingInDb = await this.prisma.channel.findFirst({
        where: { normalizedName: normalized, deletedAt: null },
        select: { id: true },
      });

      if (existingInDb) {
        // Concurrent sync already created it — adopt it
        channelId = existingInDb.id;
        byNorm.set(normalized, channelId);
        if (item.githubChannelId) byGhId.set(item.githubChannelId, channelId);
      } else {
        // Genuinely new — create it
        const slug = uniqueSlug(slugify(item.name), slugSet);
        try {
          const created = await this.prisma.channel.create({
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
          stats.added++;
        } catch (e: any) {
          if (e?.code !== P2002) throw e;
          // Another process won the race — re-fetch the winner
          const winner = await this.prisma.channel.findFirst({
            where: { normalizedName: normalized, deletedAt: null },
            select: { id: true },
          });
          if (!winner) throw e;   // should never happen
          channelId = winner.id;
        }

        byNorm.set(normalized, channelId);
        if (item.githubChannelId) byGhId.set(item.githubChannelId, channelId);
      }
    } else {
      // Channel already exists — sync non-overridden metadata from source
      const ch = await this.prisma.channel.findUnique({
        where: { id: channelId },
        select: { adminLogoOverride: true, adminNameOverride: true },
      });
      const updateData: Record<string, unknown> = { normalizedName: normalized };
      if (!ch?.adminNameOverride) updateData.name = item.name;
      if (item.logo && !ch?.adminLogoOverride) updateData.logo = item.logo;
      await this.prisma.channel.update({ where: { id: channelId }, data: updateData });
    }

    // ── 2. Resolve ChannelServer ─────────────────────────────────────────────
    //
    // existingServers is already filtered to this githubSourceId, so each
    // source manages only its own server rows.  Matching by (channelId + link)
    // means the same channel listed twice with different URLs gets two rows.

    const existingServer =
      (item.githubChannelId
        ? existingServers.find(s => s.githubChannelId === item.githubChannelId)
        : undefined) ??
      existingServers.find(s => s.channelId === channelId && s.link === item.link);

    if (existingServer) {
      await this.prisma.channelServer.update({
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
      const newServer = await this.prisma.channelServer.create({
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
