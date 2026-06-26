import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

const makeSetting = (key: string, value: unknown, isPublic = false) => ({
  id: `setting-${key}`,
  key,
  value,
  description: `${key} setting`,
  isPublic,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockPrisma = {
  setting: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
};

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    jest.clearAllMocks();
  });

  describe('getAll()', () => {
    it('returns all settings', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([makeSetting('theme', 'dark')]);
      const result = await service.getAll();
      expect(result).toHaveLength(1);
      expect(mockPrisma.setting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('filters to public-only settings when publicOnly=true', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([]);
      await service.getAll(true);
      expect(mockPrisma.setting.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublic: true } }),
      );
    });
  });

  describe('get()', () => {
    it('returns a setting by key', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(makeSetting('maintenance', { enabled: false }));
      const result = await service.get('maintenance');
      expect(result.key).toBe('maintenance');
    });

    it('throws NotFoundException for missing key', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(null);
      await expect(service.get('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('set()', () => {
    it('upserts a setting value', async () => {
      const s = makeSetting('maintenance', { enabled: true });
      mockPrisma.setting.upsert.mockResolvedValue(s);

      const result = await service.set('maintenance', { enabled: true });
      expect(mockPrisma.setting.upsert).toHaveBeenCalled();
      expect(result.key).toBe('maintenance');
    });

    it('passes optional description and isPublic fields', async () => {
      mockPrisma.setting.upsert.mockResolvedValue(makeSetting('theme', 'dark', true));
      await service.set('theme', 'dark', 'App theme', true);
      expect(mockPrisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ description: 'App theme', isPublic: true }),
        }),
      );
    });
  });

  describe('delete()', () => {
    it('deletes an existing setting', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(makeSetting('old_key', 'val'));
      mockPrisma.setting.delete.mockResolvedValue({});

      const result = await service.delete('old_key');
      expect(result.message).toBe('Setting deleted');
    });

    it('throws NotFoundException when setting does not exist', async () => {
      mockPrisma.setting.findUnique.mockResolvedValue(null);
      await expect(service.delete('ghost')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.setting.delete).not.toHaveBeenCalled();
    });
  });

  describe('getPublicConfig()', () => {
    it('returns only public settings as a flat key-value object', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        makeSetting('theme', 'dark', true),
        makeSetting('ads_enabled', true, true),
      ]);
      const result = await service.getPublicConfig();
      expect(result).toEqual({ theme: 'dark', ads_enabled: true });
    });
  });

  describe('getAppConfig()', () => {
    it('returns app config keys as a flat map', async () => {
      mockPrisma.setting.findMany.mockResolvedValue([
        makeSetting('maintenance', { enabled: false }, true),
        makeSetting('app_version', { latest: '2.0.0' }, true),
      ]);
      const result = await service.getAppConfig();
      expect(result).toHaveProperty('maintenance');
      expect(result).toHaveProperty('app_version');
    });
  });
});
