import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, StreamType, HealthOverride, ServerSourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { BulkImportChannelsDto } from './dto/bulk-import-channel.dto';
import { M3uImportService } from '../m3u-import/m3u-import.service';
import { normalizeName, GitHubSyncService } from '../github-sync/github-sync.service';
import { cookieExpiryInfo } from '../m3u-import/stream-validation.service';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private prisma: PrismaService,
    private importService: M3uImportService,
    private githubSyncService: GitHubSyncService,
  ) {}

  async findAll(query: PaginationDto & { categoryId?: string; isPremium?: boolean; isFeatured?: boolean }) {
    const { skip, limit = 20, page = 1, search } = query;
    const where: Prisma.ChannelWhereInput = { deletedAt: null };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (query.categoryId) where.categoryId = query.categoryId;
    // HTTP query params arrive as strings even when typed as boolean; cast first.
    if (query.isPremium !== undefined) where.isPremium = String(query.isPremium) === 'true';
    if (query.isFeatured !== undefined) where.isFeatured = String(query.isFeatured) === 'true';

    const [data, total] = await Promise.all([
      this.prisma.channel.findMany({
        where, skip, take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.channel.count({ where }),
    ]);
    return { data, meta: paginate(total, page, limit) };
  }

  async findOne(id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null },
      include: {
        category: true,
        epgPrograms: {
          where: { endTime: { gte: new Date() } },
          orderBy: { startTime: 'asc' },
          take: 10,
        },
        servers: {
          where: { deletedAt: null, enabled: true },
          orderBy: { priority: 'asc' },
          // PUBLIC PATH: omit credential-bearing fields (cookie, userAgent, referer, origin)
          // so anonymous viewers cannot harvest upstream auth headers.
          select: {
            id: true,
            channelId: true,
            link: true,
            priority: true,
            enabled: true,
            sourceType: true,
            healthCheckEnabled: true,
            createdBySync: true,
            githubSourceId: true,
            githubSource: { select: { id: true, name: true } },
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    // Public path: do NOT compute cookie expiry because we no longer select the cookie value.
    // (cookieExpired defaults to false; the player doesn't need this signal on the public path.)
    const servers = (channel as any).servers.map((srv: any) => ({
      ...srv,
      cookieExpired: false,
      cookieExpiresAt: null,
    }));

    return { ...channel, servers };
  }

  /**
   * Admin-only variant of findOne() that returns the full server rows including
   * credential fields (cookie, userAgent, referer, origin). Used by the
   * GET /channels/:id/details admin endpoint so admins can edit headers without
   * leaking them to anonymous viewers on the public GET /channels/:id endpoint.
   */
  async findOneAdmin(id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null },
      include: {
        category: true,
        epgPrograms: {
          where: { endTime: { gte: new Date() } },
          orderBy: { startTime: 'asc' },
          take: 10,
        },
        servers: {
          where: { deletedAt: null },
          orderBy: { priority: 'asc' },
          include: {
            githubSource: { select: { id: true, name: true, lastSyncAt: true, lastSyncStatus: true, lastSyncMessage: true } },
          },
        },
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    const servers = channel.servers.map((srv: any) => {
      if (!srv.cookie) return { ...srv, cookieExpired: false, cookieExpiresAt: null };
      const info = cookieExpiryInfo(srv.cookie);
      return { ...srv, cookieExpired: info.expired, cookieExpiresAt: info.expiresAt?.toISOString() ?? null };
    });

    return { ...channel, servers };
  }

  async getStreamUrl(id: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null, isActive: true },
      select: { id: true, name: true, primaryStreamUrl: true, backupStreamUrl: true, streamType: true, isPremium: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    if (!channel.primaryStreamUrl) throw new NotFoundException('Stream URL not available for this channel');
    return {
      streamUrl: channel.primaryStreamUrl,
      backupUrl: channel.backupStreamUrl ?? null,
      streamType: channel.streamType,
      id: channel.id,
      name: channel.name,
      isPremium: channel.isPremium,
    };
  }

  async create(dto: CreateChannelDto) {
    const existing = await this.prisma.channel.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    const normalized = normalizeName(dto.name);
    const channel = await this.prisma.channel.create({
      data: { ...(dto as Prisma.ChannelCreateInput), normalizedName: normalized },
    });
    // NOTE: Auto health-check disabled — stream URLs may be geo-restricted and unreachable
    // from the server even if they play fine on user devices. Channels stay active (isActive=true)
    // as set during creation. Use the manual recheck endpoint to validate specific channels.
    return channel;
  }

  async update(id: string, dto: Partial<CreateChannelDto>) {
    await this.findOne(id);
    return this.prisma.channel.update({ where: { id }, data: dto as Prisma.ChannelUpdateInput });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.channel.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Channel deleted' };
  }

  async incrementViewCount(id: string) {
    await this.prisma.channel.update({ where: { id }, data: { viewCount: { increment: 1 } } });
  }

  async getFeatured() {
    return this.prisma.channel.findMany({
      where: { isFeatured: true, isActive: true, deletedAt: null },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { sortOrder: 'asc' },
      take: 20,
    });
  }

  async getTrending() {
    return this.prisma.channel.findMany({
      where: { isTrending: true, isActive: true, deletedAt: null },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { viewCount: 'desc' },
      take: 20,
    });
  }

  async bulkImport(dto: BulkImportChannelsDto) {
    const { channels } = dto;
    let imported = 0;
    let skipped = 0;
    let addedAsServer = 0;
    const errors: string[] = [];

    // Pre-fetch all existing channels for dedup
    const allExisting = await this.prisma.channel.findMany({
      where: { deletedAt: null },
      select: { id: true, normalizedName: true, primaryStreamUrl: true, epgChannelId: true, slug: true },
    });
    const existingUrls = new Set(allExisting.map(c => c.primaryStreamUrl).filter(Boolean));
    const existingTvgIds = new Set(allExisting.map(c => c.epgChannelId).filter(Boolean));
    const existingSlugs = new Set(allExisting.map(c => c.slug));
    // normalizedName → channelId map for same-name dedup
    const byNorm = new Map<string, string>();
    for (const c of allExisting) {
      if (c.normalizedName) byNorm.set(c.normalizedName, c.id);
    }

    for (const ch of channels) {
      try {
        if (ch.primaryStreamUrl && this.isPrivateUrl(ch.primaryStreamUrl)) {
          errors.push(`${ch.name}: Stream URL targets a private/internal address`);
          continue;
        }

        // Skip exact duplicate stream URL
        if (existingUrls.has(ch.primaryStreamUrl)) { skipped++; continue; }

        const normalized = normalizeName(ch.name);
        const existingChannelId = normalized ? byNorm.get(normalized) : undefined;

        if (existingChannelId) {
          // Same name → add the URL as a new server instead of creating a duplicate channel
          if (ch.primaryStreamUrl) {
            const existingServer = await this.prisma.channelServer.findFirst({
              where: { channelId: existingChannelId, link: ch.primaryStreamUrl, deletedAt: null },
            });
            if (!existingServer) {
              await this.prisma.channelServer.create({
                data: {
                  channelId: existingChannelId,
                  link: ch.primaryStreamUrl,
                  priority: 100,
                  sourceType: ServerSourceType.ADMIN,
                  healthCheckEnabled: true,
                  enabled: true,
                  createdBySync: false,
                },
              });
              existingUrls.add(ch.primaryStreamUrl);
              addedAsServer++;
            } else {
              skipped++;
            }
          } else {
            skipped++;
          }
          continue;
        }

        if (ch.epgChannelId && existingTvgIds.has(ch.epgChannelId)) { skipped++; continue; }

        const baseSlug = ch.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'channel';
        let slug = baseSlug;
        let attempt = 0;
        const MAX_SLUG_ATTEMPTS = 100;
        while (existingSlugs.has(slug)) {
          attempt++;
          if (attempt > MAX_SLUG_ATTEMPTS) {
            slug = `${baseSlug}-${Date.now()}`;
            break;
          }
          slug = `${baseSlug}-${attempt}`;
        }

        const created = await this.prisma.channel.create({
          data: {
            name: ch.name,
            slug,
            normalizedName: normalized || undefined,
            logo: ch.logo || undefined,
            primaryStreamUrl: ch.primaryStreamUrl,
            categoryId: ch.categoryId || undefined,
            country: ch.country || undefined,
            language: ch.language || undefined,
            epgChannelId: ch.epgChannelId || undefined,
            streamType: (Object.values(StreamType) as string[]).includes(ch.streamType as string)
              ? (ch.streamType as StreamType)
              : StreamType.HLS,
            isActive: ch.isActive !== undefined ? ch.isActive : true,
          },
        });
        // Track newly created entries to avoid duplicates within the same import batch
        existingUrls.add(created.primaryStreamUrl);
        if (created.epgChannelId) existingTvgIds.add(created.epgChannelId);
        existingSlugs.add(created.slug);
        if (normalized) byNorm.set(normalized, created.id);
        imported++;
      } catch (e: any) {
        errors.push(`${ch.name}: ${e?.message ?? 'Unknown error'}`);
      }
    }

    return { imported, skipped, addedAsServer, errors, total: channels.length };
  }

  private isPrivateUrl(urlStr: string): boolean {
    try {
      const { hostname, protocol } = new URL(urlStr);
      if (!['http:', 'https:'].includes(protocol)) return true;
      const h = hostname.toLowerCase().replace(/^\[|\]$/g, ''); // strip IPv6 brackets
      return (
        h === 'localhost' || h === '0.0.0.0' || h === '::1' ||
        h.endsWith('.local') || h.endsWith('.internal') ||
        /^127\./.test(h) ||
        /^10\./.test(h) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
        /^192\.168\./.test(h) ||
        /^169\.254\./.test(h) ||  // AWS/Azure metadata
        /^fc00:/i.test(h) || /^fe80:/i.test(h)  // IPv6 private ranges
      );
    } catch { return true; }
  }

  async parsePlaylistUrl(url: string) {
    if (this.isPrivateUrl(url)) {
      throw new Error('URL must point to a publicly accessible host');
    }
    let content: string;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'StreamPro/1.0' }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      content = await res.text();
    } catch (e: any) {
      throw new Error(`Failed to fetch playlist: ${e?.message ?? 'Unknown error'}`);
    }
    return { content, contentType: url.includes('.json') ? 'json' : url.includes('.csv') ? 'csv' : 'm3u' };
  }

  async setHealthOverride(id: string, override: HealthOverride) {
    await this.findOne(id);
    // Sync isActive with the override so the channel list reflects the intent:
    // FORCE_HEALTHY → make visible to users (isActive = true)
    // FORCE_OFFLINE → hide from users (isActive = false)
    // AUTO          → leave isActive unchanged, health determined automatically
    const extra: { isActive?: boolean } = {};
    if (override === HealthOverride.FORCE_HEALTHY) extra.isActive = true;
    if (override === HealthOverride.FORCE_OFFLINE) extra.isActive = false;
    return this.prisma.channel.update({ where: { id }, data: { healthOverride: override, ...extra } });
  }

  async getChannelHealthStats(channelId: string, healthMode: string) {
    const channel = await this.findOne(channelId);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = await this.prisma.playbackEvent.findMany({
      where: { channelId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const successCount = events.filter(e => e.success).length;
    const failureCount = events.filter(e => !e.success).length;
    const total = successCount + failureCount;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : null;
    const lastSuccess = events.find(e => e.success)?.createdAt ?? null;
    const lastFailure = events.find(e => !e.success)?.createdAt ?? null;

    let playbackHealth = 'unknown';
    if (successRate !== null) {
      if (successRate >= 80) playbackHealth = 'healthy';
      else if (successRate >= 50) playbackHealth = 'unstable';
      else playbackHealth = 'offline';
    }

    const serverHealth = channel.streamStatus === 'active' ? 'healthy' : channel.streamStatus;
    const override = channel.healthOverride;

    if (override === HealthOverride.FORCE_HEALTHY) {
      return { serverHealth, playbackHealth, effectiveHealth: 'healthy', overrideMode: override, healthMode, successCount, failureCount, successRate, lastSuccess, lastFailure };
    }
    if (override === HealthOverride.FORCE_OFFLINE) {
      return { serverHealth, playbackHealth, effectiveHealth: 'offline', overrideMode: override, healthMode, successCount, failureCount, successRate, lastSuccess, lastFailure };
    }

    let effectiveHealth: string;
    if (healthMode === 'SERVER') effectiveHealth = serverHealth;
    else if (healthMode === 'USER_PLAYBACK') effectiveHealth = playbackHealth === 'unknown' ? 'healthy' : playbackHealth;
    else effectiveHealth = 'unknown';

    return { serverHealth, playbackHealth, effectiveHealth, overrideMode: override, healthMode, successCount, failureCount, successRate, lastSuccess, lastFailure };
  }

  async exportChannels(format: 'json' | 'csv' | 'm3u') {
    const channels = await this.prisma.channel.findMany({
      where: { deletedAt: null },
      include: { category: { select: { name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    if (format === 'json') {
      return JSON.stringify(channels.map(c => ({
        name: c.name,
        logo: c.logo,
        primaryStreamUrl: c.primaryStreamUrl,
        streamType: c.streamType,
        category: c.category?.name,
        country: c.country,
        language: c.language,
        epgChannelId: c.epgChannelId,
        isActive: c.isActive,
      })), null, 2);
    }

    if (format === 'csv') {
      const headers = ['name', 'logo', 'primaryStreamUrl', 'streamType', 'category', 'country', 'language', 'epgChannelId', 'isActive'];
      const rows = channels.map(c => [
        c.name, c.logo ?? '', c.primaryStreamUrl ?? '', c.streamType ?? '',
        c.category?.name ?? '', c.country ?? '', c.language ?? '',
        c.epgChannelId ?? '', c.isActive ? 'true' : 'false',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      return [headers.join(','), ...rows].join('\n');
    }

    const lines = ['#EXTM3U'];
    for (const c of channels) {
      if (!c.primaryStreamUrl) continue;
      const attrs = [
        `-1`,
        c.epgChannelId ? ` tvg-id="${c.epgChannelId}"` : '',
        c.name ? ` tvg-name="${c.name}"` : '',
        c.logo ? ` tvg-logo="${c.logo}"` : '',
        c.category?.name ? ` group-title="${c.category.name}"` : '',
        c.country ? ` tvg-country="${c.country}"` : '',
        c.language ? ` tvg-language="${c.language}"` : '',
      ].join('');
      lines.push(`#EXTINF:${attrs},${c.name}`);
      lines.push(c.primaryStreamUrl);
    }
    return lines.join('\n');
  }

  // ── Server management ───────────────────────────────────────────────────────

  async getServers(channelId: string) {
    await this.findOne(channelId);
    return this.prisma.channelServer.findMany({
      where: { channelId, deletedAt: null },
      orderBy: { priority: 'asc' },
      include: {
        githubSource: {
          select: { id: true, name: true, lastSyncAt: true, lastSyncStatus: true, lastSyncMessage: true },
        },
      },
    });
  }

  async addServer(channelId: string, dto: {
    link: string;
    cookie?: string;
    userAgent?: string;
    referer?: string;
    origin?: string;
    priority?: number;
  }) {
    await this.findOne(channelId);
    return this.prisma.channelServer.create({
      data: {
        channelId,
        link: dto.link,
        cookie: dto.cookie ?? null,
        userAgent: dto.userAgent ?? null,
        referer: dto.referer ?? null,
        origin: dto.origin ?? null,
        priority: dto.priority ?? 0,
        sourceType: ServerSourceType.ADMIN,
        healthCheckEnabled: true,
        enabled: true,
        createdBySync: false,
      },
      include: { githubSource: { select: { id: true, name: true } } },
    });
  }

  async reorderServers(channelId: string, servers: { id: string; priority: number }[]) {
    await this.findOne(channelId);
    await this.prisma.$transaction(
      servers.map(s =>
        this.prisma.channelServer.update({
          where: { id: s.id, channelId },
          data: { priority: s.priority },
        }),
      ),
    );
    return this.getServers(channelId);
  }

  async updateServer(channelId: string, serverId: string, dto: {
    enabled?: boolean;
    link?: string;
    cookie?: string | null;
    userAgent?: string | null;
    referer?: string | null;
    origin?: string | null;
  }) {
    const server = await this.prisma.channelServer.findFirst({
      where: { id: serverId, channelId, deletedAt: null },
    });
    if (!server) throw new NotFoundException('Server not found');
    await this.prisma.channelServer.update({ where: { id: serverId }, data: dto });
    return this.getServers(channelId);
  }

  async deleteServer(channelId: string, serverId: string) {
    const server = await this.prisma.channelServer.findFirst({
      where: { id: serverId, channelId, deletedAt: null },
    });
    if (!server) throw new NotFoundException('Server not found');
    await this.prisma.channelServer.update({
      where: { id: serverId },
      data: { deletedAt: new Date() },
    });
    return { message: 'Server removed' };
  }

  async testServer(channelId: string, serverId: string) {
    const server = await this.prisma.channelServer.findFirst({
      where: { id: serverId, channelId, deletedAt: null },
    });
    if (!server) throw new NotFoundException('Server not found');

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const reqHeaders: Record<string, string> = {
        'User-Agent': server.userAgent ?? 'StreamPro/1.0',
        'Range': 'bytes=0-1023',
      };
      if (server.cookie)  reqHeaders['Cookie']  = server.cookie;
      if (server.referer) reqHeaders['Referer'] = server.referer;
      if (server.origin)  reqHeaders['Origin']  = server.origin;

      // Try HEAD first; many HLS CDNs reject HEAD so fall back to GET with a byte range
      let res = await fetch(server.link, {
        method: 'HEAD',
        signal: controller.signal,
        headers: reqHeaders,
      }).catch(() => null);

      if (!res || res.status === 405 || res.status === 400 || res.status === 501) {
        const getController = new AbortController();
        const getTimer = setTimeout(() => getController.abort(), 12000);
        res = await fetch(server.link, {
          method: 'GET',
          signal: getController.signal,
          headers: reqHeaders,
        });
        clearTimeout(getTimer);
        // Consume a tiny chunk then close to avoid downloading the whole stream
        const reader = res.body?.getReader();
        if (reader) {
          await reader.read();
          reader.cancel().catch(() => {});
        }
      }

      clearTimeout(timer);
      const latencyMs = Date.now() - startTime;
      const ok = res.ok || res.status === 206 || res.status === 200;
      return {
        ok,
        status: res.status,
        latencyMs,
        contentType: res.headers.get('content-type') ?? null,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: null,
        latencyMs: Date.now() - startTime,
        error: err?.name === 'AbortError' ? 'Timeout (12s)' : err?.message ?? 'Connection failed',
      };
    }
  }

  // ── Manual deduplication ────────────────────────────────────────────────────

  async mergeDuplicates(): Promise<{ message: string; groupsMerged: number; backfilled: number }> {
    // Step 1 — Backfill normalizedName for channels that don't have it yet
    // (e.g. channels imported via M3U before the dedup fix was applied)
    const missing = await this.prisma.channel.findMany({
      where: { normalizedName: null, deletedAt: null },
      select: { id: true, name: true },
    });

    let backfilled = 0;
    for (const ch of missing) {
      const norm = normalizeName(ch.name);
      if (norm) {
        await this.prisma.channel.update({
          where: { id: ch.id },
          data: { normalizedName: norm },
        });
        backfilled++;
      }
    }
    if (backfilled > 0) {
      this.logger.log(`Backfilled normalizedName for ${backfilled} channel(s)`);
    }

    // Step 2 — Find groups with the same normalizedName and merge them
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
      const msg = backfilled > 0
        ? `নাম পূরণ করা হয়েছে ${backfilled}টি চ্যানেলে। কোনো duplicate পাওয়া যায়নি।`
        : 'কোনো duplicate চ্যানেল পাওয়া যায়নি।';
      return { message: msg, groupsMerged: 0, backfilled };
    }

    let merged = 0;
    for (const group of dupeGroups) {
      try {
        await this.githubSyncService.mergeDuplicateGroup(group.normalizedName, group.ids, 'manual');
        merged++;
      } catch (e: any) {
        this.logger.error(`Failed to merge group "${group.normalizedName}": ${e.message}`);
      }
    }

    const parts: string[] = [];
    if (backfilled > 0) parts.push(`${backfilled}টি চ্যানেলে নাম backfill`);
    parts.push(`${merged}টি duplicate group merge হয়েছে (${dupeGroups.length}টির মধ্যে)`);

    return {
      message: parts.join(' | '),
      groupsMerged: merged,
      backfilled,
    };
  }

  // ── Bad-name cleanup ────────────────────────────────────────────────────────

  /**
   * Find channels whose name looks like an image-URL artifact (e.g.
   * "q_75,f_webp/.../poster.png'Channel Name") from the old broken M3U parser,
   * and soft-delete them so a fresh GitHub sync can recreate them with correct names.
   * Channels that have admin-managed servers or admin name overrides are preserved.
   */
  async cleanupBadChannelNames(): Promise<{ deleted: number; preserved: number; names: string[] }> {
    const BAD_NAME_PATTERN = /\.(png|jpg|jpeg|webp|gif|svg)['"]/i;

    const candidates = await this.prisma.channel.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        adminNameOverride: true,
        servers: {
          where: { deletedAt: null, sourceType: ServerSourceType.ADMIN },
          select: { id: true },
        },
      },
    });

    const badOnes = candidates.filter(c => BAD_NAME_PATTERN.test(c.name));
    let deleted = 0;
    let preserved = 0;
    const deletedNames: string[] = [];

    for (const ch of badOnes) {
      // Preserve channels that have admin-set overrides or manually-added servers
      if (ch.adminNameOverride || ch.servers.length > 0) {
        preserved++;
        continue;
      }
      await this.prisma.channel.update({
        where: { id: ch.id },
        data: { deletedAt: new Date() },
      });
      deletedNames.push(ch.name.slice(0, 80));
      deleted++;
    }

    this.logger.log(`Bad-name cleanup: deleted=${deleted}, preserved=${preserved}`);
    return { deleted, preserved, names: deletedNames };
  }

  // ── Admin overrides ─────────────────────────────────────────────────────────

  async updateOverrides(channelId: string, dto: {
    adminNameOverride?: string | null;
    adminLogoOverride?: string | null;
    adminCategoryIdOverride?: string | null;
    categoryId?: string | null;
  }) {
    await this.findOne(channelId);
    return this.prisma.channel.update({ where: { id: channelId }, data: dto });
  }

  async resetOverride(channelId: string, field: string) {
    const allowed = ['adminNameOverride', 'adminLogoOverride', 'adminCategoryIdOverride'];
    if (!allowed.includes(field)) throw new BadRequestException(`Invalid override field: ${field}`);
    await this.findOne(channelId);
    return this.prisma.channel.update({ where: { id: channelId }, data: { [field]: null } });
  }
}
