import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const mockPrisma = {
  $queryRaw: jest.fn(),
};

const mockStorage = {
  isConfigured: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  describe('healthz()', () => {
    it('returns status ok with timestamp', () => {
      const result = controller.healthz();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('health()', () => {
    it('returns ok when DB is reachable', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      const result = await controller.health();
      expect(result.status).toBe('ok');
      expect(result.database).toBeDefined();
      expect(result.database.status).toBe('ok');
    });

    it('returns degraded when DB is unreachable', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      const result = await controller.health();
      expect(result.status).toBe('degraded');
      expect(result.database.status).toBe('error');
    });
  });

  describe('healthDatabase()', () => {
    it('returns 200 with ok status when DB is reachable', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([1]);
      const result = await controller.healthDatabase();
      expect(result.status).toBe('ok');
      expect(result.responseTimeMs).toBeDefined();
    });

    it('throws 503 when DB is unreachable', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB error'));
      await expect(controller.healthDatabase()).rejects.toThrow(HttpException);
      await expect(controller.healthDatabase()).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    });
  });

  describe('healthStorage()', () => {
    it('returns ok when storage is configured', () => {
      mockStorage.isConfigured.mockReturnValue(true);
      const result = controller.healthStorage() as Record<string, unknown>;
      expect(result['status']).toBe('ok');
      expect(result['configured']).toBe(true);
    });

    it('returns degraded when storage is not configured', () => {
      mockStorage.isConfigured.mockReturnValue(false);
      const result = controller.healthStorage() as Record<string, unknown>;
      expect(result['status']).toBe('degraded');
      expect(result['configured']).toBe(false);
    });
  });

  describe('healthWebSocket()', () => {
    it('returns ok with namespace info', () => {
      const result = controller.healthWebSocket() as Record<string, unknown>;
      expect(result['status']).toBe('ok');
      expect(result['namespace']).toBe('/ws');
    });
  });

  describe('healthFull()', () => {
    it('returns ok when all services are healthy', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([1]);
      mockStorage.isConfigured.mockReturnValue(true);
      const result = await controller.healthFull();
      expect(result.status).toBe('ok');
      expect(result.services.database.status).toBe('ok');
      expect(result.services.storage.status).toBe('ok');
      expect(result.services.websocket.status).toBe('ok');
    });

    it('throws 503 when database is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      mockStorage.isConfigured.mockReturnValue(true);
      await expect(controller.healthFull()).rejects.toThrow(HttpException);
    });

    it('includes system info (uptime, memory)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([1]);
      mockStorage.isConfigured.mockReturnValue(true);
      const result = await controller.healthFull();
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(result.memory).toHaveProperty('heapUsedMB');
    });
  });

  describe('ready()', () => {
    it('returns ready when DB is reachable', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([1]);
      const result = await controller.ready();
      expect(result.status).toBe('ready');
    });

    it('throws 503 when DB is not ready', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB down'));
      await expect(controller.ready()).rejects.toThrow(HttpException);
    });
  });

  describe('live()', () => {
    it('always returns live', () => {
      const result = controller.live();
      expect(result.status).toBe('live');
    });
  });
});
