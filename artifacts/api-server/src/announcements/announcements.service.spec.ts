import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { PrismaService } from '../prisma/prisma.service';

const makeAnnouncement = (overrides = {}) => ({
  id: 'ann-1',
  title: 'Scheduled Maintenance',
  message: 'Down 2am-4am Sunday',
  type: 'warning',
  priority: 1,
  imageUrl: null,
  deepLink: null,
  isDismissible: true,
  targetAll: true,
  country: null,
  language: null,
  isPremium: null,
  isActive: true,
  startsAt: null,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockPrisma = {
  announcement: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('AnnouncementsService', () => {
  let service: AnnouncementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AnnouncementsService>(AnnouncementsService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('returns paginated announcements', async () => {
      mockPrisma.announcement.findMany.mockResolvedValue([makeAnnouncement()]);
      mockPrisma.announcement.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20, skip: 0 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getActive()', () => {
    it('returns only active announcements within valid date range', async () => {
      mockPrisma.announcement.findMany.mockResolvedValue([makeAnnouncement({ isActive: true })]);
      const result = await service.getActive();
      expect(result).toHaveLength(1);
      expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('returns empty array when no active announcements', async () => {
      mockPrisma.announcement.findMany.mockResolvedValue([]);
      const result = await service.getActive();
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne()', () => {
    it('returns an announcement by id', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue(makeAnnouncement());
      const result = await service.findOne('ann-1');
      expect(result.id).toBe('ann-1');
    });

    it('throws NotFoundException for missing announcement', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue(null);
      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('creates an announcement', async () => {
      const ann = makeAnnouncement();
      mockPrisma.announcement.create.mockResolvedValue(ann);

      const result = await service.create({ title: 'Test', message: 'Test message' });
      expect(mockPrisma.announcement.create).toHaveBeenCalled();
      expect(result.title).toBe('Scheduled Maintenance');
    });
  });

  describe('update()', () => {
    it('updates an existing announcement', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue(makeAnnouncement());
      mockPrisma.announcement.update.mockResolvedValue(makeAnnouncement({ title: 'Updated' }));

      const result = await service.update('ann-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('throws NotFoundException when announcement not found', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue(null);
      await expect(service.update('ghost', { title: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove()', () => {
    it('deletes an announcement', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue(makeAnnouncement());
      mockPrisma.announcement.delete.mockResolvedValue({});

      const result = await service.remove('ann-1');
      expect(result.message).toBeDefined();
    });

    it('throws NotFoundException when announcement not found', async () => {
      mockPrisma.announcement.findUnique.mockResolvedValue(null);
      await expect(service.remove('ghost')).rejects.toThrow(NotFoundException);
    });
  });
});
