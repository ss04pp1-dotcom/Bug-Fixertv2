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
      // True atomic upsert on the composite unique (userId, query). Eliminates
      // the findFirst-then-create race window entirely — no duplicate rows,
      // no P2002 to swallow.
      await this.prisma.searchHistory.upsert({
        where: { userId_query: { userId, query: q } },
        update: { createdAt: new Date() },
        create: { userId, query: q },
      }).catch((e: Error) => this.logger.warn(`Search history upsert failed for user ${userId}: ${e.message}`));
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
