import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  constructor(private prisma: PrismaService) {}

  async globalSearch(query: string, userId?: string) {
    if (!query || query.trim().length < 2) return { channels: [], movies: [], series: [] };
    const q = query.trim();

    const [channels, movies, series] = await Promise.all([
      this.prisma.channel.findMany({
        where: { isActive: true, deletedAt: null, name: { contains: q, mode: 'insensitive' } },
        take: 5, select: { id: true, name: true, logo: true, slug: true, isPremium: true },
      }),
      this.prisma.movie.findMany({
        where: { isActive: true, deletedAt: null, title: { contains: q, mode: 'insensitive' } },
        take: 5, select: { id: true, title: true, poster: true, slug: true, isPremium: true, year: true },
      }),
      this.prisma.series.findMany({
        where: { isActive: true, deletedAt: null, title: { contains: q, mode: 'insensitive' } },
        take: 5, select: { id: true, title: true, poster: true, slug: true, isPremium: true, year: true },
      }),
    ]);

    if (userId) {
      // A-060: upsert instead of always-create so repeat searches for the same query
      // bump `createdAt` (most-recent-first ordering) instead of spawning duplicate
      // rows that pollute the user's search history. Requires @@unique([userId, query])
      // on SearchHistory (added in schema).
      // A-060: upsert-via-create-or-update so repeat searches bump createdAt
      // instead of spawning duplicate rows. Uses try/catch on create to handle
      // concurrent duplicate inserts gracefully (P2002 unique constraint).
      const existing = await this.prisma.searchHistory.findFirst({ where: { userId, query: q } });
      if (existing) {
        await this.prisma.searchHistory.update({
          where: { id: existing.id },
          data: { createdAt: new Date() },
        }).catch((e: Error) => this.logger.warn(`Search history update failed for user ${userId}: ${e.message}`));
      } else {
        await this.prisma.searchHistory.create({ data: { userId, query: q } })
          .catch((e: Error) => this.logger.warn(`Search history create failed for user ${userId}: ${e.message}`));
      }
    }

    return { channels, movies, series, query: q };
  }

  async getSearchHistory(userId: string) {
    return this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async clearSearchHistory(userId: string) {
    await this.prisma.searchHistory.deleteMany({ where: { userId } });
    return { message: 'Search history cleared' };
  }

  async getTrendingSearches() {
    const result = await this.prisma.searchHistory.groupBy({
      by: ['query'],
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 10,
    });
    return result.map((r) => ({ query: r.query, count: r._count.query }));
  }
}
