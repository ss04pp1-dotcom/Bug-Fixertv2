import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  channel: { findMany: jest.fn() },
  movie: { findMany: jest.fn() },
  series: { findMany: jest.fn() },
  searchHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
};

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    jest.clearAllMocks();

    // Default empty results
    mockPrisma.channel.findMany.mockResolvedValue([]);
    mockPrisma.movie.findMany.mockResolvedValue([]);
    mockPrisma.series.findMany.mockResolvedValue([]);
    mockPrisma.searchHistory.create.mockResolvedValue({});
  });

  describe('globalSearch()', () => {
    it('returns structured search results', async () => {
      mockPrisma.channel.findMany.mockResolvedValue([{ id: 'ch-1', name: 'CNN', slug: 'cnn' }]);
      mockPrisma.movie.findMany.mockResolvedValue([{ id: 'mv-1', title: 'Inception' }]);

      const result = await service.globalSearch('CNN');
      expect(result).toHaveProperty('channels');
      expect(result).toHaveProperty('movies');
      expect(result).toHaveProperty('series');
      expect(result.channels).toHaveLength(1);
      expect(result.query).toBe('CNN');
    });

    it('returns empty arrays for short queries (< 2 chars)', async () => {
      const result = await service.globalSearch('a');
      expect(result.channels).toHaveLength(0);
      expect(result.movies).toHaveLength(0);
      expect(result.series).toHaveLength(0);
      expect(mockPrisma.channel.findMany).not.toHaveBeenCalled();
    });

    it('returns empty results for empty query', async () => {
      const result = await service.globalSearch('');
      expect(result.channels).toHaveLength(0);
      expect(mockPrisma.channel.findMany).not.toHaveBeenCalled();
    });

    it('saves search history when userId is provided', async () => {
      await service.globalSearch('breaking news', 'user-1');
      expect(mockPrisma.searchHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', query: 'breaking news' }) }),
      );
    });

    it('does not save search history when no userId', async () => {
      await service.globalSearch('breaking news');
      expect(mockPrisma.searchHistory.create).not.toHaveBeenCalled();
    });

    it('does not fail if history save throws', async () => {
      mockPrisma.searchHistory.create.mockRejectedValue(new Error('DB error'));
      const result = await service.globalSearch('test query', 'user-1');
      expect(result).toHaveProperty('channels');
    });
  });

  describe('getSearchHistory()', () => {
    it('returns search history for a user ordered by date', async () => {
      mockPrisma.searchHistory.findMany.mockResolvedValue([
        { id: '1', query: 'news', createdAt: new Date() },
      ]);
      const result = await service.getSearchHistory('user-1');
      expect(result).toHaveLength(1);
      expect(mockPrisma.searchHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' }, take: 20 }),
      );
    });
  });

  describe('clearSearchHistory()', () => {
    it('deletes all history for a user', async () => {
      mockPrisma.searchHistory.deleteMany.mockResolvedValue({ count: 5 });
      const result = await service.clearSearchHistory('user-1');
      expect(mockPrisma.searchHistory.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(result.message).toBe('Search history cleared');
    });
  });

  describe('getTrendingSearches()', () => {
    it('returns top 10 trending searches with counts', async () => {
      mockPrisma.searchHistory.groupBy.mockResolvedValue([
        { query: 'news', _count: { query: 100 } },
        { query: 'sports', _count: { query: 80 } },
      ]);
      const result = await service.getTrendingSearches();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ query: 'news', count: 100 });
    });
  });
});
