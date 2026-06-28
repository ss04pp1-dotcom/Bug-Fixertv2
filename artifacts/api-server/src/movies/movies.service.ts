import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreateMovieDto } from './dto/create-movie.dto';
import { AuthenticatedUser } from '../common/interfaces';

@Injectable()
export class MoviesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { categoryId?: string; isPremium?: boolean; genre?: string }) {
    const { skip, limit = 20, page = 1, search } = query;
    const where: Prisma.MovieWhereInput = { deletedAt: null };
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.genre) where.category = { name: { contains: query.genre, mode: 'insensitive' } };
    // HTTP query params arrive as strings even when typed as boolean; cast first.
    if (query.isPremium !== undefined) where.isPremium = String(query.isPremium) === 'true';

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

  async getStreamUrl(id: string, user?: AuthenticatedUser) {
    const movie = await this.prisma.movie.findFirst({
      where: { OR: [{ id }, { slug: id }], deletedAt: null },
      select: { id: true, title: true, streamUrl: true, isPremium: true, isActive: true },
    });
    if (!movie) throw new NotFoundException('Movie not found');
    if (!movie.streamUrl) throw new NotFoundException('Stream URL not available for this movie');
    // Premium-gate: non-premium users (or expired premium) cannot stream premium movies.
    // This blocks the well-known bypass where the client just hits GET /movies/:id/stream
    // directly and ignores the isPremium flag returned by the catalog endpoint.
    if (movie.isPremium) {
      const isPremium = !!user?.isPremium &&
        (!user.subscriptionEndsAt || new Date(user.subscriptionEndsAt) > new Date());
      if (!isPremium) {
        throw new ForbiddenException('Premium subscription required');
      }
    }
    return { streamUrl: movie.streamUrl, id: movie.id, title: movie.title, isPremium: movie.isPremium };
  }

  async findRelated(id: string, limit = 10) {
    // A-057: clamp limit so a client can't ask for thousands of related movies in one shot.
    const safeLimit = Math.min(parseInt(String(limit)) || 10, 50);
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
      take: safeLimit,
    });

    if (related.length < safeLimit) {
      const existingIds = [movie.id, ...related.map(r => r.id)];
      const fallback = await this.prisma.movie.findMany({
        where: { id: { notIn: existingIds }, isActive: true, deletedAt: null },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { viewCount: 'desc' },
        take: safeLimit - related.length,
      });
      return [...related, ...fallback];
    }

    return related;
  }
}
