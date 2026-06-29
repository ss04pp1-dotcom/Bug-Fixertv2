import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubSyncStatus, ServerSourceType } from '@prisma/client';
import { M3uParser } from './parsers/m3u.parser';
import { JsonParser } from './parsers/json.parser';
import { ParsedChannel } from './parsers/parser.interface';
import { LogoResolverService } from './logo-resolver.service';

/**
 * Normalise a channel name for deduplication.
 * 1. Strips quality/resolution suffixes: (HD), [720p], (1080p), (4K), (FHD) etc.
 *    These are stream-quality labels, NOT part of the channel identity.
 *    "Desh TV (1080p)" and "Desh TV (720p)" should map to the same channel.
 * 2. Strips common regional/type suffixes at the end of names:
 *    "News 24 BD" → "news 24", "Gopal Bhar TV" → "gopal bhar"
 *    Suffixes stripped: BD, TV, Channel, Bangladesh, India, HD (already above).
 *    Only stripped when they appear as a standalone word at the end (space-separated),
 *    so "MTV", "ETV", "NDTV" etc. are NOT affected.
 * 3. Collapses whitespace, hyphens, underscores and dots into a single space
 *    so "Sony HD", "SONY-HD", "Sony_HD" all produce "sony".
 * NOTE: numeric suffixes like "[2]" or "2" are intentionally kept because
 *   they denote separate streams (e.g. "Toffee 2" ≠ "Toffee").
 */
export function normalizeName(name: string): string {
  // These suffixes are stripped repeatedly in case of stacking e.g. "Channel BD TV"
  const STRIP_SUFFIXES = /\s+(bd|tv|channel|bangladesh|india|pak|pakistan|int|international|official|live)$/gi;

  let result = name
    .toLowerCase()
    // Strip quality/resolution tags in parentheses or brackets
    .replace(/[\(\[]\s*(hd|fhd|sd|4k|uhd|720p|1080p|480p|360p|240p|2160p|576p|4320p)\s*[\)\]]/gi, '')
    // Strip quality suffix at end of name ("Channel HD", "Channel 720p")
    .replace(/\s+(hd|fhd|sd|4k|uhd|720p|1080p|480p|360p|576p|2160p)$/gi, '')
    // Collapse whitespace, hyphens, underscores and dots
    .replace(/[\s\-_\.]+/g, ' ')
    .trim();

  // Strip regional/type suffixes repeatedly (handles stacked suffixes)
  let prev: string;
  do {
    prev = result;
    result = result.replace(STRIP_SUFFIXES, '').trim();
  } while (result !== prev);

  return result;
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

/**
 * Strip query string and fragment from a URL so that two URLs that differ only
 * in token/session query params are treated as the same stream endpoint.
 *
 * Example:
 *   "http://server:8080/LIVE-Sports/video.m3u8?token=OLD" → "http://server:8080/LIVE-Sports/video.m3u8"
 *   "http://server:8080/LIVE-Sports/video.m3u8?token=NEW" → "http://server:8080/LIVE-Sports/video.m3u8"
 *
 * Used as a third-pass match when githubChannelId is absent — handles auto-updated
 * playlists (like T-Sports-Playlist-Auto-Update) where only the token changes between syncs.
 */
function urlWithoutQuery(link: string): string {
  try {
    const u = new URL(link);
    return `${u.origin}${u.pathname}`;
  } catch {
    // Fallback for malformed URLs: strip everything after '?'
    return link.split('?')[0].split('#')[0];
  }
}

interface SourceHeaderDefaults {
  cookie:     string | null;
  userAgent:  string | null;
  referer:    string | null;
  origin:     string | null;
}

@Injectable()
export class GitHubSyncService implements OnModuleInit {
  private readonly logger = new Logger(GitHubSyncService.name);
  private readonly parsers = [new JsonParser(), new M3uParser()];

  /**
   * Set to true once startup deduplication completes (or is skipped on error).
   * The scheduler checks this before firing any sync to guarantee dedup always
   * runs first, regardless of NestJS bootstrap timing.
   */
  private dedupReady = false;

  constructor(
    private prisma: PrismaService,
    private logoResolver: LogoResolverService,
  ) {}

  isDedupReady(): boolean {
    return this.dedupReady;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    // FIRST: clear any stale `isSyncing: true` rows left over from a previous process
    // that crashed mid-sync. Without this, those GitHubSources stay locked forever and
    // the scheduler refuses to re-sync them (see `if (source.isSyncing)` guard in sync()).
    // This must run BEFORE deduplication so the scheduler sees a clean state on startup.
    try {
      const cleared = await this.prisma.gitHubSource.updateMany({
        where: { isSyncing: true },
        data: { isSyncing: false, syncStartedAt: null },
      });
      if (cleared.count > 0) {
        this.logger.warn(
          `Startup: cleared ${cleared.count} stale isSyncing=true GitHubSource row(s) left by a previous crash`,
        );
      }
    } catch (e: any) {
      this.logger.error(`Startup stale-lock cleanup failed: ${e.message}`);
    }

    // A-050: schedule deduplication on the next event-loop tick via setImmediate so it
    // does NOT block NestModule init resolution. Other modules that depend on
    // GithubSyncService (or just need the DI graph to finish wiring) get to construct
    // synchronously; the dedup runs afterwards. Failures are caught and logged so they
    // never crash the bootstrap.

    // Safety: if dedup hangs for any reason, unblock the scheduler after 90 s so
    // scheduled syncs are never permanently blocked by a stuck dedup.
    const dedupTimeout = setTimeout(() => {
      if (!this.dedupReady) {
        this.logger.warn('Startup deduplication safety timeout (90s) reached — unblocking scheduler');
        this.dedupReady = true;
      }
    }, 90_000);

    setImmediate(() => {
      try {
        this.deduplicateExistingChannels()
          .catch((err: Error) => {
            // Dedup failures must never block the entire app from starting
            this.logger.error(`Startup deduplication encountered an unhandled error: ${err.message}`, err.stack);
          })
          .finally(() => {
            // Always unblock the scheduler, even if dedup partially failed
            clearTimeout(dedupTimeout);
            this.dedupReady = true;
          });
      } catch (err: any) {
        this.logger.error(`Startup deduplication threw synchronously: ${err.message}`, err.stack);
        clearTimeout(dedupTimeout);
        this.dedupReady = true;
      }
    });
  }

  // ── Startup deduplication ─────────────────────────────────────────────────

  /**
   * Finds every group of Channel rows that share the same normalizedName and
   * merges them into the oldest record (by created_at).
   *
   * Guarantees:
   *   • Idempotent — safe to call multiple times; never creates duplicate rows.
   *   • Isolated — a failure on one group is logged and skipped; the rest continue.
   *   • Complete — handles all FK relations: ChannelServer, PlaybackEvent,
   *     EpgProgram and Favorite.
   *   • Audited — writes one ChannelMergeLog row per successfully merged group.
   *   • Server-safe — when a duplicate server (same source + URL already exists
   *     on the keeper) is encountered it is soft-deleted, not re-assigned.
   */
  async deduplicateExistingChannels(): Promise<void> {
    const startedAt = Date.now();

    const dupeGroups = await this.prisma.$queryRaw<
      { normalizedName: string; ids: string[] }[]
    >`
      SELECT
        normalized_name AS "normalizedName",
        array_agg(id::text ORDER BY created_at ASC) AS ids
      FROM channels
      WHERE normalized_name IS NOT NULL
        AND deleted_at IS NULL
      GROUP BY normalized_name
      HAVING count(*) > 1
    `;

    if (dupeGroups.length === 0) {
      this.logger.log('Startup deduplication: no duplicate channel groups found');
      return;
    }

    this.logger.warn(
      `Startup deduplication: ${dupeGroups.length} duplicate group(s) found — merging…`,
    );

    let merged = 0;
    let skipped = 0;

    for (const group of dupeGroups) {
      try {
        await this.mergeDuplicateGroup(group.normalizedName, group.ids, 'startup');
        merged++;
      } catch (e: any) {
        skipped++;
        this.logger.error(
          `Dedup: failed to merge group "${group.normalizedName}" ` +
          `(ids: ${group.ids.join(', ')}): ${e.message}`,
        );
      }
    }

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `Startup deduplication complete in ${durationMs}ms — ` +
      `merged: ${merged}, skipped (errors): ${skipped}`,
    );
  }

  /**
   * Core merge logic — reusable by both startup dedup and any future
   * manual merge endpoint.
   *
   * @param normalizedName  The shared key for this duplicate group
   * @param ids             Channel IDs — first entry is the keeper (oldest),
   *                        remaining entries are soft-deleted after merge
   * @param trigger         Label recorded in the audit log ("startup" | "manual")
   */
  async mergeDuplicateGroup(
    normalizedName: string,
    ids: string[],
    trigger: 'startup' | 'manual',
  ): Promise<void> {
    const [keepId, ...removeIds] = ids;
    if (removeIds.length === 0) return;

    this.logger.log(
      `Merging "${normalizedName}": keeper=${keepId}, removing=[${removeIds.join(', ')}]`,
    );

    // ── Servers ─────────────────────────────────────────────────────────────
    //
    // Dedup key: (githubSourceId, link) — the same source + URL pair must
    // never appear twice under the keeper.
    //
    // 1. Load all active servers on the keeper to build a presence set.
    // 2. For each server on a duplicate channel:
    //    a. Key already on keeper  → soft-delete the duplicate server.
    //    b. Key absent on keeper   → reassign to keeper, add key to set.

    const keeperServers = await this.prisma.channelServer.findMany({
      where: { channelId: keepId, deletedAt: null },
      select: { id: true, githubSourceId: true, link: true },
    });

    // Presence set: "githubSourceId::link"
    const keeperServerKeys = new Set(
      keeperServers.map((s: { githubSourceId: string | null; link: string }) => `${s.githubSourceId ?? ''}::${s.link}`),
    );

    const dupeServers = await this.prisma.channelServer.findMany({
      where: { channelId: { in: removeIds } },
      select: { id: true, githubSourceId: true, link: true, deletedAt: true },
    });

    let serversMoved = 0;
    let serversDeduplicated = 0;

    for (const srv of dupeServers) {
      const key = `${srv.githubSourceId ?? ''}::${srv.link}`;

      if (keeperServerKeys.has(key)) {
        // Exact duplicate — soft-delete rather than reassign
        if (!srv.deletedAt) {
          await this.prisma.channelServer.update({
            where: { id: srv.id },
            data: { deletedAt: new Date() },
          });
        }
        serversDeduplicated++;
      } else {
        // Not on keeper — move it over (even if soft-deleted; preserve state)
        await this.prisma.channelServer.update({
          where: { id: srv.id },
          data: { channelId: keepId },
        });
        keeperServerKeys.add(key);
        if (!srv.deletedAt) serversMoved++;
      }
    }

    // ── PlaybackEvent ────────────────────────────────────────────────────────
    // A-037: wrap the cross-relation reassignments + soft-delete + audit log in
    // a single transaction so a crash between any of them can't leave the
    // duplicate channels half-merged (e.g. playback_events moved but channels
    // not soft-deleted, so dedup would re-process them on next startup and
    // double-move the rows / produce duplicate audit logs).
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE playback_events
        SET channel_id = ${keepId}::uuid
        WHERE channel_id = ANY(${removeIds}::uuid[])
      `;

      // ── EpgProgram ───────────────────────────────────────────────────────────
      await tx.$executeRaw`
        UPDATE epg_programs
        SET channel_id = ${keepId}::uuid
        WHERE channel_id = ANY(${removeIds}::uuid[])
      `;

      // ── Favorite ─────────────────────────────────────────────────────────────
      // Delete any favorite-on-duplicate where the user already has a favorite
      // for the keeper (prevents duplicate (userId, keepId) rows), then
      // reassign the rest.
      await tx.$executeRaw`
        DELETE FROM favorites
        WHERE channel_id = ANY(${removeIds}::uuid[])
          AND EXISTS (
            SELECT 1 FROM favorites f2
            WHERE f2.user_id  = favorites.user_id
              AND f2.channel_id = ${keepId}::uuid
          )
      `;
      await tx.$executeRaw`
        UPDATE favorites
        SET channel_id = ${keepId}::uuid
        WHERE channel_id = ANY(${removeIds}::uuid[])
      `;

      // ── Soft-delete the duplicate Channel rows ───────────────────────────────
      await tx.channel.updateMany({
        where: { id: { in: removeIds } },
        data: { deletedAt: new Date() },
      });

      // ── Audit log ────────────────────────────────────────────────────────────
      await tx.channelMergeLog.create({
        data: {
          trigger,
          normalizedName,
          keptChannelId: keepId,
          mergedChannelIds: removeIds,
          serversMoved,
          serversDeduplicated,
          details: {
            keeperId: keepId,
            mergedIds: removeIds,
            serversOnKeeperBefore: keeperServers.length,
            dupeServersFound: dupeServers.length,
          },
        },
      });
    });

    this.logger.log(
      `Merged "${normalizedName}": moved ${serversMoved} server(s), ` +
      `deduplicated ${serversDeduplicated} server(s)`,
    );
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
      // Always clear ETag/Last-Modified before fetching so every sync — both
      // scheduled and manual — re-fetches the full file content. This guarantees
      // that even a single character change in the source is picked up immediately.
      await this.prisma.gitHubSource.update({
        where: { id: sourceId },
        data: { etag: null, lastModified: null },
      });

      const { content } = await this.fetchContent(source.url);

      await this.prisma.gitHubSource.update({
        where: { id: sourceId },
        data: { lastFetchedAt: new Date() },
      });

      const parsed = this.detectAndParse(content, source.url);
      stats.totalParsed = parsed.length;
      this.logger.log(`Source ${source.name}: parsed ${parsed.length} channels`);

      const sourceDefaults: SourceHeaderDefaults = {
        cookie:    source.cookie    ?? null,
        userAgent: source.userAgent ?? null,
        referer:   source.referer   ?? null,
        origin:    source.origin    ?? null,
      };

      await this.applyChanges(sourceId, parsed, stats, sourceDefaults);
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

  /**
   * Convert a GitHub blob UI URL to a raw content URL so we fetch the actual
   * file content instead of an HTML page.
   * github.com/user/repo/blob/REF/path → raw.githubusercontent.com/user/repo/REF/path
   */
  private toRawGitHubUrl(url: string): string {
    return url.replace(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/,
      'https://raw.githubusercontent.com/$1/$2/$3',
    );
  }

  private async fetchContent(
    url: string,
    etag?: string,
    lastModified?: string,
  ): Promise<{ content: string; etag?: string; lastModified?: string; unchanged: boolean }> {
    // Convert GitHub blob URLs to raw URLs — blob URLs return HTML, not file content
    const fetchUrl = this.toRawGitHubUrl(url);
    if (fetchUrl !== url) {
      this.logger.log(`GitHub blob URL converted to raw: ${fetchUrl}`);
    }

    const headers: Record<string, string> = {
      'User-Agent': 'StreamPro-Sync/1.0',
      'Accept': 'text/plain,application/json,*/*',
    };
    if (etag) headers['If-None-Match'] = etag;
    if (lastModified) headers['If-Modified-Since'] = lastModified;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(fetchUrl, { headers, signal: controller.signal });
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
    sourceDefaults: SourceHeaderDefaults = { cookie: null, userAgent: null, referer: null, origin: null },
  ): Promise<void> {
    // Active servers from this source (used for soft-delete of removed entries)
    const existingServers: ExistingServer[] = await this.prisma.channelServer.findMany({
      where: { githubSourceId: sourceId, deletedAt: null },
      select: { id: true, channelId: true, link: true, githubChannelId: true },
    });

    const seenServerIds = new Set<string>();

    // A-051: previously this method pre-loaded ALL non-deleted channels into memory
    // (`allChannels = await prisma.channel.findMany({ where: { deletedAt: null } })`)
    // and built in-memory `byNorm` / `byGhId` / `slugSet` lookup maps from them.
    // On a 50k-channel catalog that's hundreds of MB of resident memory and a multi-second
    // blocking query at the start of every sync. The per-item DB lookup below is cached
    // in the same maps after first hit, so subsequent parsed items for the same channel
    // reuse the in-memory entry — same throughput, vastly lower peak memory.
    const byNorm = new Map<string, string>();   // normalizedName → channelId (within this sync)
    const byGhId = new Map<string, string>();   // githubChannelId → channelId (within this sync)
    const slugSet = new Set<string>();           // slugs already used in this sync

    // Pre-load ALL channel slugs (including soft-deleted) so uniqueSlug() never
    // collides with the DB unique index. Soft-deleted rows still hold their slug
    // in the unique index, so we must treat them as taken.
    const existingSlugRows = await this.prisma.channel.findMany({
      select: { slug: true },
    });
    for (const row of existingSlugRows) slugSet.add(row.slug);

    const categoryCache = new Map<string, string>(); // groupName → categoryId

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
        categoryCache,
        sourceDefaults,
      );
    }

    // Servers not seen in this sync are intentionally left active.
    // A separate daily scheduler (cleanupStaleGithubServers) will soft-delete
    // them after 2 days if they are still missing, so short-lived outages or
    // temporary source changes do not immediately remove channels from the DB.
    const missedCount = existingServers.filter(s => !seenServerIds.has(s.id)).length;
    if (missedCount > 0) {
      this.logger.log(
        `${missedCount} server(s) not seen in this sync — will be cleaned up by the stale-server job if absent for 2+ days`,
      );
    }
  }

  /**
   * Process a slice of parsed channels.
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
    categoryCache: Map<string, string>,
    sourceDefaults: SourceHeaderDefaults = { cookie: null, userAgent: null, referer: null, origin: null },
  ): Promise<void> {
    for (const item of batch) {
      try {
        await this.processItem(
          item, sourceId, existingServers, seenServerIds, byNorm, byGhId, slugSet, stats, categoryCache, sourceDefaults,
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
    categoryCache: Map<string, string>,
    sourceDefaults: SourceHeaderDefaults = { cookie: null, userAgent: null, referer: null, origin: null },
  ): Promise<void> {
    const normalized = normalizeName(item.name);
    if (!normalized) return;

    // ── 0. Resolve Category (if group-title present) ─────────────────────────
    let categoryId: string | null = null;
    if (item.groupCategory) {
      categoryId = await this.resolveCategory(item.groupCategory, categoryCache);
    }

    // ── 1. Resolve Channel ───────────────────────────────────────────────────
    //
    // Priority: normalizedName match FIRST (most reliable), then githubChannelId.
    // We deliberately do NOT use githubChannelId as the primary lookup because
    // many M3U files assign the same tvg-id to several distinct channels
    // (e.g. tvg-id="toffee" for "Toffee 1", "Toffee 2", … "Toffee 5").
    // Using tvg-id first would collapse all those into one channel; using the
    // normalizedName keeps them separate.

    let channelId: string | undefined =
      byNorm.get(normalized) ??
      (item.githubChannelId ? byGhId.get(item.githubChannelId) : undefined);

    // Verify that a githubChannelId hit actually matches this normalizedName;
    // if it doesn't, treat as "not found" so we look up / create correctly.
    if (channelId && !byNorm.has(normalized)) {
      const ghChannel = await this.prisma.channel.findFirst({
        where: { id: channelId, normalizedName: normalized, deletedAt: null },
        select: { id: true },
      });
      if (!ghChannel) channelId = undefined;
    }

    if (!channelId) {
      // Not in in-memory maps — re-check DB (concurrent sync or soft-deleted channel)
      // Search including soft-deleted rows so we can restore them instead of hitting
      // a P2002 unique constraint on normalizedName.
      const existingInDb = await this.prisma.channel.findFirst({
        where: { normalizedName: normalized },
        select: { id: true, deletedAt: true },
      });

      if (existingInDb) {
        channelId = existingInDb.id;
        // Restore soft-deleted channel if needed
        if (existingInDb.deletedAt) {
          this.logger.log(`Restoring soft-deleted channel "${item.name}" found in DB pre-check`);
          await this.prisma.channel.update({
            where: { id: channelId },
            data: {
              deletedAt: null,
              isActive: true,
              name: item.name,
              primaryStreamUrl: item.link,
              ...(categoryId ? { categoryId } : {}),
            },
          });
          stats.added++;
        }
        byNorm.set(normalized, channelId as string);
        if (item.githubChannelId) byGhId.set(item.githubChannelId, channelId as string);
      } else {
        // Create a brand-new channel
        const slug = uniqueSlug(slugify(item.name), slugSet);

        // Auto-fetch logo if M3U source didn't provide one
        let resolvedLogo = item.logo ?? null;
        if (!resolvedLogo) {
          const autoLogo = await this.logoResolver.resolve(item.name, item.githubChannelId);
          if (autoLogo) {
            resolvedLogo = autoLogo;
            this.logger.debug(`Auto-logo resolved for "${item.name}": ${autoLogo}`);
          }
        }

        try {
          const created = await this.prisma.channel.create({
            data: {
              name: item.name,
              slug,
              normalizedName: normalized,
              githubChannelId: item.githubChannelId ?? null,
              logo: resolvedLogo,
              primaryStreamUrl: item.link,
              isActive: true,
              ...(categoryId ? { categoryId } : {}),
            },
            select: { id: true },
          });
          channelId = created.id;
          stats.added++;
        } catch (e: any) {
          if (e?.code !== P2002) throw e;

          // P2002 can happen because:
          //   a) A concurrent sync created the channel first (race) → winner has deletedAt: null
          //   b) The user deleted all channels (soft-delete) → winner has deletedAt set.
          //      In this case we restore the soft-deleted row instead of creating a new one,
          //      because the DB unique index on normalizedName still holds the old row.
          const winner = await this.prisma.channel.findFirst({
            where: {
              OR: [
                { normalizedName: normalized },
                { slug: slugify(item.name) },
              ],
            },
            select: { id: true, deletedAt: true },
          });

          if (!winner) throw e;

          // If the winner is soft-deleted, restore it so it becomes active again
          if (winner.deletedAt) {
            this.logger.log(`Restoring soft-deleted channel "${item.name}" (normalizedName: ${normalized})`);
            await this.prisma.channel.update({
              where: { id: winner.id },
              data: {
                deletedAt: null,
                isActive: true,
                name: item.name,
                primaryStreamUrl: item.link,
                ...(categoryId ? { categoryId } : {}),
              },
            });
            stats.added++;
          }

          channelId = winner.id;
        }

        byNorm.set(normalized, channelId as string);
        if (item.githubChannelId) byGhId.set(item.githubChannelId, channelId as string);
      }
    } else {
      // Channel already found — update metadata (never overwrite admin overrides)
      const ch = await this.prisma.channel.findUnique({
        where: { id: channelId },
        select: { adminLogoOverride: true, adminNameOverride: true, adminCategoryIdOverride: true, logo: true },
      });
      const updateData: Record<string, unknown> = { normalizedName: normalized };
      if (!ch?.adminNameOverride) updateData.name = item.name;
      // Only set logo if:
      //   1. import provides one
      //   2. no admin override exists
      //   3. channel has NO logo yet (never overwrite an existing logo)
      if (item.logo && !ch?.adminLogoOverride && !ch?.logo) updateData.logo = item.logo;
      if (categoryId && !ch?.adminCategoryIdOverride) updateData.categoryId = categoryId;
      try {
        await this.prisma.channel.update({ where: { id: channelId }, data: updateData });
      } catch (e: any) {
        if (e?.code !== P2002) throw e;
        // normalizedName conflicts with another channel — update everything except normalizedName
        const { normalizedName: _skip, ...safeData } = updateData as Record<string, unknown>;
        if (Object.keys(safeData).length > 0) {
          await this.prisma.channel.update({ where: { id: channelId }, data: safeData });
        }
      }
      stats.updated++;
      byNorm.set(normalized, channelId);
      if (item.githubChannelId) byGhId.set(item.githubChannelId, channelId);
    }

    // ── 2. Resolve ChannelServer ─────────────────────────────────────────────
    //
    // existingServers is filtered to this githubSourceId — each source owns
    // only its own server rows.
    //
    // Three-pass matching (in order of reliability):
    //
    // Pass 1 — githubChannelId (tvg-id from M3U): most reliable, stable across token rotations.
    //   Matches even when the URL (token) has changed.
    //
    // Pass 2 — exact URL match (channelId + link): works when URL is stable.
    //
    // Pass 3 — base-URL match (channelId + URL without query string):
    //   Handles auto-updated playlists (e.g. T-Sports-Playlist-Auto-Update) where
    //   only the `?token=` query parameter changes between syncs.  Without this pass,
    //   every token rotation creates a new orphan server row — the channel accumulates
    //   stale-token rows, the API returns the oldest (expired) one first, and the
    //   stream fails even though a valid-token row also exists.
    //   Condition: only applied when githubChannelId is absent (otherwise Pass 1 already fired).
    const newBaseUrl = urlWithoutQuery(item.link);
    const existingServer =
      (item.githubChannelId
        ? existingServers.find(s => s.githubChannelId === item.githubChannelId)
        : undefined) ??
      existingServers.find(s => s.channelId === channelId && s.link === item.link) ??
      (!item.githubChannelId
        ? existingServers.find(s => s.channelId === channelId && urlWithoutQuery(s.link) === newBaseUrl)
        : undefined);

    // Per-item headers take priority; fall back to source-level defaults so that
    // a GitHub source configured with a shared Cookie/UA/Referer/Origin applies
    // those values to every channel it manages — even entries that don't carry
    // their own header attributes in the M3U/JSON file.
    const headerFields = {
      cookie:    item.cookie    ?? sourceDefaults.cookie    ?? null,
      userAgent: item.userAgent ?? sourceDefaults.userAgent ?? null,
      referer:   item.referer   ?? sourceDefaults.referer   ?? null,
      origin:    item.origin    ?? sourceDefaults.origin    ?? null,
    };

    if (existingServer) {
      await this.prisma.channelServer.update({
        where: { id: existingServer.id },
        data: {
          channelId,
          link: item.link,
          ...headerFields,
          lastSeenAt: new Date(),
          deletedAt: null,
          enabled: true,
        },
      });
      seenServerIds.add(existingServer.id);
      stats.updated++;
    } else {
      // Global dedup: check across ALL sources — same (channelId + link) must not
      // be created twice even if a different GitHub source owns it.
      const globalExisting = await this.prisma.channelServer.findFirst({
        where: { channelId, link: item.link, deletedAt: null },
        select: { id: true },
      });

      if (globalExisting) {
        // Another source already tracks this URL for this channel — update headers/cookie only
        await this.prisma.channelServer.update({
          where: { id: globalExisting.id },
          data: {
            ...headerFields,
            lastSeenAt: new Date(),
            deletedAt: null,
            enabled: true,
          },
        });
        seenServerIds.add(globalExisting.id);
        existingServers.push({
          id: globalExisting.id,
          channelId,
          link: item.link,
          githubChannelId: item.githubChannelId ?? null,
        });
        stats.updated++;
      } else {
        const newServer = await this.prisma.channelServer.create({
          data: {
            channelId,
            link: item.link,
            cookie:    item.cookie    ?? null,
            userAgent: item.userAgent ?? null,
            referer:   item.referer   ?? null,
            origin:    item.origin    ?? null,
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
  }

  /**
   * Find or create a Category by its display name.
   * Uses an in-memory cache (per sync run) to avoid N+1 DB hits.
   * The slug is derived from the group name; conflicts fall back to the
   * existing row so this method is safe to call concurrently.
   */
  private async resolveCategory(groupName: string, cache: Map<string, string>): Promise<string | null> {
    const key = groupName.trim().toLowerCase();
    if (cache.has(key)) return cache.get(key)!;

    const slug = groupName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90) || 'uncategorized';

    try {
      let category = await this.prisma.category.findFirst({
        where: { slug, deletedAt: null },
        select: { id: true },
      });

      if (!category) {
        category = await this.prisma.category.create({
          data: {
            name: groupName.trim(),
            slug,
            isActive: true,
          },
          select: { id: true },
        });
        this.logger.log(`Created category "${groupName}" (slug: ${slug})`);
      }

      cache.set(key, category.id);
      return category.id;
    } catch (e: any) {
      // Unique constraint race — another sync created it first
      if (e?.code === 'P2002') {
        const existing = await this.prisma.category.findFirst({
          where: { slug, deletedAt: null },
          select: { id: true },
        });
        if (existing) {
          cache.set(key, existing.id);
          return existing.id;
        }
      }
      this.logger.warn(`Could not resolve category "${groupName}": ${e.message}`);
      return null;
    }
  }

  /**
   * Daily cleanup: soft-delete GitHub-managed servers that have not been seen
   * in any sync for 2+ days, then clean up any channels that become orphaned.
   *
   * Rules:
   *  • Only targets servers where githubSourceId IS NOT NULL (GitHub-owned).
   *  • A server is "stale" when lastSeenAt < (now − 48 h) AND deletedAt IS NULL.
   *  • After soft-deleting a stale server, if the channel has NO other active
   *    servers (from any source) the channel itself is also soft-deleted.
   *  • If the channel still has active servers from another source or admin, it
   *    is kept — only the stale GitHub server is removed.
   */
  async cleanupStaleGithubServers(): Promise<void> {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

    const staleServers = await this.prisma.channelServer.findMany({
      where: {
        githubSourceId: { not: null },
        deletedAt: null,
        lastSeenAt: { lt: cutoff },
      },
      select: { id: true, channelId: true },
    });

    if (staleServers.length === 0) {
      this.logger.log('Stale-server cleanup: nothing to clean up');
      return;
    }

    this.logger.log(`Stale-server cleanup: found ${staleServers.length} server(s) not seen in 48 h`);

    const staleIds = staleServers.map(s => s.id);

    await this.prisma.channelServer.updateMany({
      where: { id: { in: staleIds } },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Stale-server cleanup: soft-deleted ${staleIds.length} server(s)`);

    // Orphan-channel cleanup: only remove channels that have zero active servers
    // left across ALL sources (GitHub + admin + manual).
    await this.cleanupOrphanChannels(staleIds);
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
