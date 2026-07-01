import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const mockNotification = {
  id: 'notif-1', title: 'Test', body: 'Body',
  type: 'GENERAL', targetAll: true, targetRoles: [], targetUsers: [],
  country: null, language: null, isPremium: null, imageUrl: null,
  deepLink: null, scheduledAt: null, sentAt: null, createdAt: new Date(),
};

const mockPrisma = {
  notification: {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: { findMany: jest.fn() },
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([mockNotification]);
      mockPrisma.notification.count.mockResolvedValue(1);
      const result = await service.findAll({ page: 1, limit: 20, skip: 0 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for missing notification', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns notification when found', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(mockNotification);
      const result = await service.findOne('notif-1');
      expect(result.id).toBe('notif-1');
    });
  });

  describe('create', () => {
    it('creates and returns notification', async () => {
      mockPrisma.notification.create.mockResolvedValue(mockNotification);
      const result = await service.create({ title: 'Test', body: 'Body' });
      expect(result.title).toBe('Test');
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when notification does not exist', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(null);
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('deletes notification and returns message', async () => {
      mockPrisma.notification.findUnique.mockResolvedValue(mockNotification);
      mockPrisma.notification.delete.mockResolvedValue(mockNotification);
      const result = await service.remove('notif-1');
      expect(result).toEqual({ message: 'Notification deleted' });
    });
  });
});
