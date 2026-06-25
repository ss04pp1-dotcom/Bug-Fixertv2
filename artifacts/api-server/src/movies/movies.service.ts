import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreateMovieDto } from './dto/create-movie.dto';

@Injectable()
export class MoviesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { categoryId?: string; isPremium?: boolean }) {
    const { skip, limit = 20, page = 1, search } = query;
    const where: Prisma.MovieWhereInput = { deletedAt: null };
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.isPremium !== undefined) where.isPremium = query.isPremium;

    const [data, total] = await Promise.all([
      this.prisma.movie.findMany({
        where, skip, take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.movie.count({ where }),
    ]);
    return { data, meta: paginate(total, page, limit) };
  }

  async findOne(id: string) {
    const movie = await this.prisma.movie.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null },
      include: { category: true },
    });
    if (!movie) throw new NotFoundException('Movie not found');
    return movie;
  }

  async create(dto: CreateMovieDto) {
    const existing = await this.prisma.movie.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    return this.prisma.movie.create({ data: dto as Prisma.MovieCreateInput });
  }

  async update(id: string, dto: Partial<CreateMovieDto>) {
    await this.findOne(id);
    if (dto.slug) {
      const conflict = await this.prisma.movie.findFirst({ where: { slug: dto.slug, deletedAt: null, NOT: { id } } });
      if (conflict) throw new ConflictException('Slug already exists');
    }
    return this.prisma.movie.update({ where: { id }, data: dto as Prisma.MovieUpdateInput });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.movie.update({ where: { id }, data: { deletedAt: new Date() } });
    return { message: 'Movie deleted' };
  }

  async getFeatured() {
    return this.prisma.movie.findMany({
      where: { isFeatured: true, isActive: true, deletedAt: null },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { sortOrder: 'asc' },
      take: 20,
    });
  }

  async getTrending() {
    return this.prisma.movie.findMany({
      where: { isTrending: true, isActive: true, deletedAt: null },
      orderBy: { viewCount: 'desc' },
      take: 20,
    });
  }

  async getStreamUrl(id: string) {
    const movie = await this.prisma.movie.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null },
      select: { id: true, title: true, streamUrl: true, isPremium: true, isActive: true },
    });
    if (!movie) throw new NotFoundException('Movie not found');
    if (!movie.streamUrl) throw new NotFoundException('Stream URL not available for this movie');
    return { streamUrl: movie.streamUrl, id: movie.id, title: movie.title, isPremium: movie.isPremium };
  }

  async findRelated(id: string, limit = 10) {
    const movie = await this.findOne(id);

    const where: Prisma.MovieWhereInput = {
      id: { not: movie.id },
      isActive: true,
      deletedAt: null,
      OR: [
        ...(movie.categoryId ? [{ categoryId: movie.categoryId }] : []),
        ...(movie.genres?.length ? [{ genres: { hasSome: movie.genres } }] : []),
      ],
    };

    const related = await this.prisma.movie.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: { viewCount: 'desc' },
      take: limit,
    });

    if (related.length < limit) {
      const existingIds = [movie.id, ...related.map(r => r.id)];
      const fallback = await this.prisma.movie.findMany({
        where: { id: { notIn: existingIds }, isActive: true, deletedAt: null },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { viewCount: 'desc' },
        take: limit - related.length,
      });
      return [...related, ...fallback];
    }

    return related;
  }
}
