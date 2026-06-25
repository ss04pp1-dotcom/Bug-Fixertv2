import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async getMyFavorites(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      include: {
        channel: { select: { id: true, name: true, logo: true, slug: true } },
        movie: { select: { id: true, title: true, poster: true, slug: true } },
        series: { select: { id: true, title: true, poster: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(userId: string, body: { channelId?: string; movieId?: string; seriesId?: string }) {
    if (!body.channelId && !body.movieId && !body.seriesId) {
      throw new BadRequestException('Provide channelId, movieId, or seriesId');
    }

    // Verify the target content exists and is not soft-deleted
    if (body.channelId) {
      const ch = await this.prisma.channel.findFirst({ where: { id: body.channelId, deletedAt: null, isActive: true } });
      if (!ch) throw new BadRequestException('Channel not found or unavailable');
    }
    if (body.movieId) {
      const mv = await this.prisma.movie.findFirst({ where: { id: body.movieId, deletedAt: null, isActive: true } });
      if (!mv) throw new BadRequestException('Movie not found or unavailable');
    }
    if (body.seriesId) {
      const sr = await this.prisma.series.findFirst({ where: { id: body.seriesId, deletedAt: null, isActive: true } });
      if (!sr) throw new BadRequestException('Series not found or unavailable');
    }

    const existing = await this.prisma.favorite.findFirst({
      where: { userId, channelId: body.channelId, movieId: body.movieId, seriesId: body.seriesId },
    });
    if (existing) return existing;
    return this.prisma.favorite.create({ data: { userId, ...body } });
  }

  async remove(userId: string, body: { channelId?: string; movieId?: string; seriesId?: string }) {
    const fav = await this.prisma.favorite.findFirst({
      where: { userId, channelId: body.channelId, movieId: body.movieId, seriesId: body.seriesId },
    });
    if (!fav) return { message: 'Not in favorites' };
    await this.prisma.favorite.delete({ where: { id: fav.id } });
    return { message: 'Removed from favorites' };
  }

  async check(userId: string, type: string, id: string) {
    const where: Prisma.FavoriteWhereInput = { userId };
    if (type === 'channel') where.channelId = id;
    else if (type === 'movie') where.movieId = id;
    else if (type === 'series') where.seriesId = id;
    const fav = await this.prisma.favorite.findFirst({ where });
    return { isFavorite: !!fav };
  }
}
