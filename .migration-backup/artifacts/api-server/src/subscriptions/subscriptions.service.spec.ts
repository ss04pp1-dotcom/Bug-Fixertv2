import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPlan = {
  id: 'plan-1', name: 'Basic', slug: 'basic', price: 9.99,
  currency: 'USD', durationDays: 30, features: ['HD', 'No ads'],
  isActive: true, sortOrder: 0, createdAt: new Date(),
  _count: { subscriptions: 5 },
};

const mockPrisma = {
  subscriptionPlan: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  subscription: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  coupon: { findFirst: jest.fn(), update: jest.fn() },
  user: { update: jest.fn() },
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    jest.clearAllMocks();
  });

  describe('getPlans', () => {
    it('returns paginated subscription plans', async () => {
      mockPrisma.subscriptionPlan.findMany.mockResolvedValue([mockPlan]);
      mockPrisma.subscriptionPlan.count.mockResolvedValue(1);

      const result = await service.getPlans({ page: 1, limit: 20, skip: 0 });
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0].name).toBe('Basic');
    });
  });

  describe('getPlan', () => {
    it('throws NotFoundException when plan not found', async () => {
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue(null);
      await expect(service.getPlan('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns plan when found by id', async () => {
      mockPrisma.subscriptionPlan.findFirst.mockResolvedValue(mockPlan);
      const result = await service.getPlan('plan-1');
      expect(result.id).toBe('plan-1');
    });
  });

  describe('getUserSubscription', () => {
    it('throws NotFoundException when user has no subscription', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      await expect(service.getUserSubscription('user-id')).rejects.toThrow('No subscription found');
    });
  });
});
