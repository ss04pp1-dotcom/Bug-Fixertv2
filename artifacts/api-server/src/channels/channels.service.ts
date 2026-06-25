import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { Prisma, StreamType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { BulkImportChannelsDto } from './dto/bulk-import-channel.dto';
import { M3uImportService } from '../m3u-import/m3u-import.service';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private prisma: PrismaService,
    private importService: M3uImportService,
  ) {}

  async findAll(query: PaginationDto & { categoryId?: string; isPremium?: boolean; isFeatured?: boolean }) {
    const { skip, limit = 20, page = 1, search } = query;
    const where: Prisma.ChannelWhereInput = { deletedAt: null };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.isPremium !== undefined) where.isPremium = query.isPremium;
    if (query.isFeatured !== undefined) where.isFeatured = query.isFeatured;

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
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  async create(dto: CreateChannelDto) {
    const existing = await this.prisma.channel.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    const channel = await this.prisma.channel.create({ data: dto as Prisma.ChannelCreateInput });
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
    const errors: string[] = [];

    // Pre-fetch all existing stream URLs and TVG IDs in 2 queries (avoid N+1)
    const allExisting = await this.prisma.channel.findMany({
      where: { deletedAt: null },
      select: { primaryStreamUrl: true, epgChannelId: true },
    });
    const existingUrls = new Set(allExisting.map(c => c.primaryStreamUrl).filter(Boolean));
    const existingTvgIds = new Set(allExisting.map(c => c.epgChannelId).filter(Boolean));
    const existingSlugs = new Set(
      (await this.prisma.channel.findMany({ select: { slug: true } })).map(c => c.slug),
    );

    for (const ch of channels) {
      try {
        if (existingUrls.has(ch.primaryStreamUrl)) { skipped++; continue; }

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

        if (ch.primaryStreamUrl && this.isPrivateUrl(ch.primaryStreamUrl)) {
          errors.push(`${ch.name}: Stream URL targets a private/internal address`);
          continue;
        }

        const created = await this.prisma.channel.create({
          data: {
            name: ch.name,
            slug,
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
        imported++;
      } catch (e: any) {
        errors.push(`${ch.name}: ${e?.message ?? 'Unknown error'}`);
      }
    }

    return { imported, skipped, errors, total: channels.length };
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
}
