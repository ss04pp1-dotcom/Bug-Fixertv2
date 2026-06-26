import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';

const mockCategory = {
  id: 'cat-1',
  name: 'News',
  slug: 'news',
  description: 'News channels',
  image: null,
  sortOrder: 0,
  deletedAt: null,
  _count: { channels: 5, movies: 2, series: 1 },
};

const mockPrisma = {
  category: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('returns paginated categories', async () => {
      mockPrisma.category.findMany.mockResolvedValue([mockCategory]);
      mockPrisma.category.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20, skip: 0 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('applies search filter to where clause', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);
      mockPrisma.category.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, skip: 0, search: 'news' });
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.objectContaining({ contains: 'news' }),
          }),
        }),
      );
    });

    it('always filters out soft-deleted records', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);
      mockPrisma.category.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, skip: 0 });
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });
  });

  describe('findOne()', () => {
    it('returns a category by id', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);
      const result = await service.findOne('cat-1');
      expect(result.id).toBe('cat-1');
    });

    it('throws NotFoundException for missing category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('creates and returns a new category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      mockPrisma.category.create.mockResolvedValue(mockCategory);

      const result = await service.create({ name: 'News', slug: 'news' });
      expect(mockPrisma.category.create).toHaveBeenCalled();
      expect(result.name).toBe('News');
    });

    it('throws ConflictException when slug already exists', async () => {
      mockPrisma.category.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.create({ name: 'Dup', slug: 'news' })).rejects.toThrow(ConflictException);
      expect(mockPrisma.category.create).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    it('updates an existing category', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);
      mockPrisma.category.update.mockResolvedValue({ ...mockCategory, name: 'Updated' });

      const result = await service.update('cat-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException when category does not exist', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      await expect(service.update('ghost', { name: 'X' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.category.update).not.toHaveBeenCalled();
    });
  });

  describe('remove()', () => {
    it('soft-deletes by setting deletedAt', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(mockCategory);
      mockPrisma.category.update.mockResolvedValue({ ...mockCategory, deletedAt: new Date() });

      const result = await service.remove('cat-1');
      expect(mockPrisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(result.message).toBe('Category deleted');
    });

    it('throws NotFoundException when category does not exist', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      await expect(service.remove('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
