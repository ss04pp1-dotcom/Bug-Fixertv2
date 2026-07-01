import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertWatchHistoryDto } from './dto/upsert-watch-history.dto';

export { UpsertWatchHistoryDto };

@Injectable()
export class WatchHistoryService {
  constructor(private prisma: PrismaService) {}

  private readonly channelInclude = {
    channel: { select: { id: true, name: true, logo: true, slug: true, primaryStreamUrl: true, category: { select: { name: true } } } },
  };

  async getHistory(userId: string, limit = 20) {
    // Clamp limit so a malicious client can't ask for the entire history table.
    const safeLimit = Math.min(Number(limit) || 20, 100);
    return this.prisma.watchHistory.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      take: safeLimit,
      include: {
        movie: { select: { id: true, title: true, poster: true, slug: true, duration: true } },
        series: { select: { id: true, title: true, poster: true, slug: true } },
        episode: { select: { id: true, title: true, episodeNumber: true, duration: true } },
        ...this.channelInclude,
      },
    });
  }

  async getContinueWatching(userId: string) {
    return this.prisma.watchHistory.findMany({
      where: { userId, completed: false, channelId: null },
      orderBy: { watchedAt: 'desc' },
      take: 10,
      include: {
        movie: { select: { id: true, title: true, poster: true, slug: true, duration: true } },
        series: { select: { id: true, title: true, poster: true, slug: true } },
        episode: { select: { id: true, title: true, episodeNumber: true, duration: true } },
      },
    });
  }

  /** Returns the most-recently-watched channels for the user. */
  async getRecentChannels(userId: string, limit = 20) {
    const safeLimit = Math.min(Number(limit) || 20, 50);
    return this.prisma.watchHistory.findMany({
      where: { userId, channelId: { not: null } },
      orderBy: { watchedAt: 'desc' },
      take: safeLimit,
      include: this.channelInclude,
    });
  }

  async upsert(userId: string, dto: UpsertWatchHistoryDto) {
    // Channel watch: upsert by (userId, channelId).
    if (dto.channelId) {
      const existing = await this.prisma.watchHistory.findFirst({
        where: { userId, channelId: dto.channelId },
      });
      if (existing) {
        return this.prisma.watchHistory.update({
          where: { id: existing.id },
          data: { position: 0, watchedAt: new Date() },
        });
      }
      return this.prisma.watchHistory.create({
        data: { userId, channelId: dto.channelId, position: 0 },
      });
    }

    // VOD / episode watch.
    const where: Prisma.WatchHistoryWhereInput = { userId };
    if (dto.episodeId) where.episodeId = dto.episodeId;
    else if (dto.movieId) where.movieId = dto.movieId;
    else if (dto.seriesId) where.seriesId = dto.seriesId;

    const existing = await this.prisma.watchHistory.findFirst({ where });
    if (existing) {
      return this.prisma.watchHistory.update({
        where: { id: existing.id },
        data: { position: dto.position, duration: dto.duration, completed: dto.completed, watchedAt: new Date() },
      });
    }
    return this.prisma.watchHistory.create({ data: { userId, ...dto } });
  }

  async remove(userId: string, id: string) {
    await this.prisma.watchHistory.deleteMany({ where: { id, userId } });
    return { message: 'Removed from history' };
  }

  async clearAll(userId: string) {
    await this.prisma.watchHistory.deleteMany({ where: { userId } });
    return { message: 'History cleared' };
  }
}
