import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreateSeriesDto, CreateSeasonDto, CreateEpisodeDto } from './dto/create-series.dto';

@Injectable()
export class SeriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { genre?: string; categoryId?: string; isActive?: string }) {
    const { skip, limit = 20, page = 1, search } = query;
    // isActive=true → only active (default for mobile/public callers)
    // isActive=false → only inactive (admin filter)
    // isActive=all → no filter (admin listing all content)
    const isActiveRaw = query.isActive !== undefined ? String(query.isActive) : 'true';
    const where: Prisma.SeriesWhereInput = { deletedAt: null };
    if (isActiveRaw !== 'all') where.isActive = isActiveRaw === 'true';
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.genre) where.category = { name: { contains: query.genre, mode: 'insensitive' } };

    const [data, total] = await Promise.all([
      this.prisma.series.findMany({
        where, skip, take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { seasons: true } },
        },
      }),
      this.prisma.series.count({ where }),
    ]);
    return { data, meta: paginate(total, page, limit) };
  }

  async findOne(id: string) {
    const series = await this.prisma.series.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null, isActive: true },
      include: {
        category: true,
        seasons: {
          where: { isActive: true },
          orderBy: { seasonNumber: 'asc' },
          include: {
            episodes: { where: { isActive: true }, orderBy: { episodeNumber: 'asc' } },
          },
        },
      },
    });
    if (!series) throw new NotFoundException('Series not found');
    return series;
  }

  /** Internal admin lookup — does NOT filter by isActive so inactive series can be updated/deleted. */
  private async findOneAdmin(id: string) {
    const series = await this.prisma.series.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null },
    });
    if (!series) throw new NotFoundException('Series not found');
    return series;
  }

  async create(dto: CreateSeriesDto) {
    const existing = await this.prisma.series.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    return this.prisma.series.create({ data: dto as Prisma.SeriesCreateInput });
  }

  async update(id: string, dto: Partial<CreateSeriesDto>) {
    const series = await this.findOneAdmin(id);
    return this.prisma.series.update({ where: { id: series.id }, data: dto as Prisma.SeriesUpdateInput });
  }

  async remove(id: string) {
    const series = await this.findOneAdmin(id);
    await this.prisma.series.update({ where: { id: series.id }, data: { deletedAt: new Date() } });
    return { message: 'Series deleted' };
  }

  async createSeason(seriesId: string, dto: CreateSeasonDto) {
    return this.prisma.season.create({ data: { seriesId, ...dto } });
  }

  async updateSeason(seasonId: string, dto: Partial<CreateSeasonDto>) {
    return this.prisma.season.update({ where: { id: seasonId }, data: dto });
  }

  async deleteSeason(seasonId: string) {
    const season = await this.prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) throw new NotFoundException('Season not found');
    await this.prisma.season.update({ where: { id: seasonId }, data: { isActive: false } });
    return { message: 'Season deleted' };
  }

  async createEpisode(seasonId: string, dto: CreateEpisodeDto) {
    return this.prisma.episode.create({ data: { seasonId, ...dto } });
  }

  async updateEpisode(episodeId: string, dto: Partial<CreateEpisodeDto>) {
    return this.prisma.episode.update({ where: { id: episodeId }, data: dto });
  }

  async deleteEpisode(episodeId: string) {
    const episode = await this.prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode) throw new NotFoundException('Episode not found');
    await this.prisma.episode.update({ where: { id: episodeId }, data: { isActive: false } });
    return { message: 'Episode deleted' };
  }

  async getFeatured() {
    return this.prisma.series.findMany({
      where: { isFeatured: true, isActive: true, deletedAt: null },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { sortOrder: 'asc' },
      take: 20,
    });
  }

  async findRelated(id: string, limit = 10) {
    // A-057: cap the limit so callers cannot request an unbounded result set.
    const safeLimit = Math.min(parseInt(String(limit)) || 10, 50);
    const series = await this.findOne(id);

    const where: Prisma.SeriesWhereInput = {
      id: { not: series.id },
      isActive: true,
      deletedAt: null,
      OR: [
        ...(series.categoryId ? [{ categoryId: series.categoryId }] : []),
        ...(series.genres?.length ? [{ genres: { hasSome: series.genres } }] : []),
      ],
    };

    const related = await this.prisma.series.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { seasons: true } },
      },
      orderBy: { viewCount: 'desc' },
      take: safeLimit,
    });

    if (related.length < safeLimit) {
      const existingIds = [series.id, ...related.map(r => r.id)];
      const fallback = await this.prisma.series.findMany({
        where: { id: { notIn: existingIds }, isActive: true, deletedAt: null },
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { seasons: true } },
        },
        orderBy: { viewCount: 'desc' },
        take: safeLimit - related.length,
      });
      return [...related, ...fallback];
    }

    return related;
  }
}
