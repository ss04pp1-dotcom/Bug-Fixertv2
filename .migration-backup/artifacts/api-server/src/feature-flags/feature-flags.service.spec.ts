import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  featureFlag: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const makeFlag = (name: string, isEnabled = true) => ({
  id: `flag-${name}`,
  name,
  isEnabled,
  description: `${name} flag`,
  roles: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
    jest.clearAllMocks();
  });

  describe('getAll()', () => {
    it('returns all feature flags ordered by name', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        makeFlag('ads'), makeFlag('live_tv'),
      ]);
      const result = await service.getAll();
      expect(result).toHaveLength(2);
      expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    });
  });

  describe('getEnabled()', () => {
    it('returns enabled flags as a name-keyed boolean map', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([
        makeFlag('ads', true), makeFlag('beta', true),
      ]);
      const result = await service.getEnabled();
      expect(result).toEqual({ ads: true, beta: true });
    });

    it('returns an empty object when no flags are enabled', async () => {
      mockPrisma.featureFlag.findMany.mockResolvedValue([]);
      const result = await service.getEnabled();
      expect(result).toEqual({});
    });
  });

  describe('get()', () => {
    it('returns an existing flag', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(makeFlag('ads'));
      const result = await service.get('ads');
      expect(result.name).toBe('ads');
    });

    it('returns {name, isEnabled: false} for unknown flag instead of throwing', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
      const result = await service.get('unknown');
      expect(result).toEqual({ name: 'unknown', isEnabled: false });
    });
  });

  describe('set()', () => {
    it('upserts a flag with name, isEnabled, and description', async () => {
      const created = makeFlag('new_feature');
      mockPrisma.featureFlag.upsert.mockResolvedValue(created);
      const result = await service.set('new_feature', true, 'A new feature');
      expect(mockPrisma.featureFlag.upsert).toHaveBeenCalled();
      expect(result.name).toBe('new_feature');
    });

    it('disables a flag', async () => {
      mockPrisma.featureFlag.upsert.mockResolvedValue(makeFlag('ads', false));
      const result = await service.set('ads', false);
      expect(result.isEnabled).toBe(false);
    });
  });

  describe('toggle()', () => {
    it('flips an enabled flag to disabled', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(makeFlag('ads', true));
      mockPrisma.featureFlag.update.mockResolvedValue(makeFlag('ads', false));

      const result = await service.toggle('ads');
      expect(mockPrisma.featureFlag.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isEnabled: false } }),
      );
      expect(result.isEnabled).toBe(false);
    });

    it('flips a disabled flag to enabled', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(makeFlag('ads', false));
      mockPrisma.featureFlag.update.mockResolvedValue(makeFlag('ads', true));

      const result = await service.toggle('ads');
      expect(result.isEnabled).toBe(true);
    });

    it('throws NotFoundException for nonexistent flag', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null);
      await expect(service.toggle('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete()', () => {
    it('deletes a flag and returns confirmation message', async () => {
      mockPrisma.featureFlag.delete.mockResolvedValue(makeFlag('old_flag'));
      const result = await service.delete('old_flag');
      expect(result.message).toBe('Feature flag deleted');
    });

    it('does not throw if flag does not exist (silent delete)', async () => {
      mockPrisma.featureFlag.delete.mockRejectedValue(new Error('not found'));
      await expect(service.delete('ghost')).resolves.toEqual({ message: 'Feature flag deleted' });
    });
  });
});
