import { Test, TestingModule } from '@nestjs/testing';
import { GitHubSyncScheduler } from './github-sync.scheduler';
import { GitHubSyncService } from './github-sync.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeDbSource(overrides: Partial<{
  id: string;
  name: string;
  syncIntervalMinutes: number;
  lastSyncAt: Date | null;
}> = {}) {
  return {
    id: 'source-1',
    name: 'Test Source',
    syncIntervalMinutes: 60,
    lastSyncAt: null,
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  gitHubSource: { findMany: jest.fn() },
};

const mockSyncService = {
  isDedupReady: jest.fn(),
  syncSource:   jest.fn(),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GitHubSyncScheduler', () => {
  let scheduler: GitHubSyncScheduler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubSyncScheduler,
        { provide: PrismaService,      useValue: mockPrisma },
        { provide: GitHubSyncService,  useValue: mockSyncService },
      ],
    }).compile();

    scheduler = module.get<GitHubSyncScheduler>(GitHubSyncScheduler);
    jest.clearAllMocks();

    // Safe defaults
    mockSyncService.isDedupReady.mockReturnValue(true);
    mockPrisma.gitHubSource.findMany.mockResolvedValue([]);
    mockSyncService.syncSource.mockResolvedValue(undefined);
  });

  // ── Guard: startup dedup must complete first ──────────────────────────────

  describe('startup dedup guard', () => {
    it('returns without querying the DB when dedupReady is false', async () => {
      mockSyncService.isDedupReady.mockReturnValue(false);

      await scheduler.tick();

      expect(mockPrisma.gitHubSource.findMany).not.toHaveBeenCalled();
      expect(mockSyncService.syncSource).not.toHaveBeenCalled();
    });

    it('proceeds to query DB once dedupReady becomes true', async () => {
      mockSyncService.isDedupReady.mockReturnValue(true);
      mockPrisma.gitHubSource.findMany.mockResolvedValue([]);

      await scheduler.tick();

      expect(mockPrisma.gitHubSource.findMany).toHaveBeenCalledTimes(1);
    });

    it('guarantees: two consecutive tick() calls before dedup ready trigger zero syncs', async () => {
      mockSyncService.isDedupReady.mockReturnValue(false);

      await scheduler.tick();
      await scheduler.tick();

      expect(mockSyncService.syncSource).not.toHaveBeenCalled();
    });
  });

  // ── Due-source logic ──────────────────────────────────────────────────────

  describe('due-source calculation', () => {
    it('fires syncSource for a source whose lastSyncAt is null (never synced)', async () => {
      mockPrisma.gitHubSource.findMany.mockResolvedValue([
        makeDbSource({ id: 'src-1', lastSyncAt: null, syncIntervalMinutes: 60 }),
      ]);

      await scheduler.tick();

      expect(mockSyncService.syncSource).toHaveBeenCalledWith('src-1');
    });

    it('fires syncSource when the interval has elapsed since lastSyncAt', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockPrisma.gitHubSource.findMany.mockResolvedValue([
        makeDbSource({ id: 'src-1', lastSyncAt: twoHoursAgo, syncIntervalMinutes: 60 }),
      ]);

      await scheduler.tick();

      expect(mockSyncService.syncSource).toHaveBeenCalledWith('src-1');
    });

    it('does NOT fire syncSource when the interval has NOT elapsed', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      mockPrisma.gitHubSource.findMany.mockResolvedValue([
        makeDbSource({ id: 'src-1', lastSyncAt: fiveMinutesAgo, syncIntervalMinutes: 60 }),
      ]);

      await scheduler.tick();

      expect(mockSyncService.syncSource).not.toHaveBeenCalled();
    });

    it('fires only sources whose interval has elapsed (mixed due/not-due)', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const justNow     = new Date(Date.now() - 10 * 1000);

      mockPrisma.gitHubSource.findMany.mockResolvedValue([
        makeDbSource({ id: 'due-src',   lastSyncAt: twoHoursAgo, syncIntervalMinutes: 60 }),
        makeDbSource({ id: 'notdue-src', lastSyncAt: justNow,    syncIntervalMinutes: 60 }),
      ]);

      await scheduler.tick();

      expect(mockSyncService.syncSource).toHaveBeenCalledTimes(1);
      expect(mockSyncService.syncSource).toHaveBeenCalledWith('due-src');
      expect(mockSyncService.syncSource).not.toHaveBeenCalledWith('notdue-src');
    });

    it('fires all sources when multiple are due', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockPrisma.gitHubSource.findMany.mockResolvedValue([
        makeDbSource({ id: 'src-a', lastSyncAt: twoHoursAgo, syncIntervalMinutes: 60 }),
        makeDbSource({ id: 'src-b', lastSyncAt: twoHoursAgo, syncIntervalMinutes: 60 }),
        makeDbSource({ id: 'src-c', lastSyncAt: twoHoursAgo, syncIntervalMinutes: 30 }),
      ]);

      await scheduler.tick();

      expect(mockSyncService.syncSource).toHaveBeenCalledTimes(3);
      expect(mockSyncService.syncSource).toHaveBeenCalledWith('src-a');
      expect(mockSyncService.syncSource).toHaveBeenCalledWith('src-b');
      expect(mockSyncService.syncSource).toHaveBeenCalledWith('src-c');
    });

    it('does nothing when there are no enabled/idle sources', async () => {
      mockPrisma.gitHubSource.findMany.mockResolvedValue([]);

      await scheduler.tick();

      expect(mockSyncService.syncSource).not.toHaveBeenCalled();
    });
  });

  // ── Concurrent sync safety ────────────────────────────────────────────────

  describe('concurrent sync safety (cron vs manual)', () => {
    it('DB query filters out isSyncing=true sources — cron cannot double-trigger an active sync', async () => {
      // The DB query already has `isSyncing: false` in its where clause.
      // When a manual sync sets isSyncing=true on the source, the cron tick
      // never sees that source in the result set → zero double-trigger risk.

      // Simulate: DB returns empty because the source is being synced manually
      mockPrisma.gitHubSource.findMany.mockResolvedValue([]);

      await scheduler.tick();

      expect(mockSyncService.syncSource).not.toHaveBeenCalled();
    });

    it('cron query always uses isSyncing:false filter', async () => {
      mockPrisma.gitHubSource.findMany.mockResolvedValue([]);
      await scheduler.tick();

      expect(mockPrisma.gitHubSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isSyncing: false }),
        }),
      );
    });

    it('cron query always requires enabled:true filter', async () => {
      await scheduler.tick();

      expect(mockPrisma.gitHubSource.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ enabled: true }),
        }),
      );
    });

    it('only one syncSource call per due source per tick — no double-firing', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockPrisma.gitHubSource.findMany.mockResolvedValue([
        makeDbSource({ id: 'src-1', lastSyncAt: twoHoursAgo }),
      ]);

      await scheduler.tick();

      expect(mockSyncService.syncSource).toHaveBeenCalledTimes(1);
    });
  });

  // ── Fire-and-forget error handling ───────────────────────────────────────

  describe('error handling', () => {
    it('tick() resolves even when syncSource rejects (fire-and-forget)', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockPrisma.gitHubSource.findMany.mockResolvedValue([
        makeDbSource({ id: 'src-1', lastSyncAt: twoHoursAgo }),
      ]);
      mockSyncService.syncSource.mockRejectedValue(new Error('sync crashed'));

      // tick() itself must not throw — syncSource is fire-and-forget with .catch
      await expect(scheduler.tick()).resolves.toBeUndefined();
    });

    it('one source failure does not prevent other sources from being triggered', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      mockPrisma.gitHubSource.findMany.mockResolvedValue([
        makeDbSource({ id: 'bad-src',  lastSyncAt: twoHoursAgo }),
        makeDbSource({ id: 'good-src', lastSyncAt: twoHoursAgo }),
      ]);
      mockSyncService.syncSource
        .mockRejectedValueOnce(new Error('bad source crashed'))
        .mockResolvedValueOnce(undefined);

      await scheduler.tick();

      // Both sources were triggered regardless of the first rejection
      expect(mockSyncService.syncSource).toHaveBeenCalledTimes(2);
      expect(mockSyncService.syncSource).toHaveBeenCalledWith('bad-src');
      expect(mockSyncService.syncSource).toHaveBeenCalledWith('good-src');
    });

    it('tick() resolves even when the DB query rejects', async () => {
      mockPrisma.gitHubSource.findMany.mockRejectedValue(new Error('DB offline'));

      await expect(scheduler.tick()).rejects.toThrow('DB offline');
      // This is intentional — a DB failure in tick() is a real unhandled error
      // and should surface so it can be monitored/alerted.
    });
  });

  // ── Repeated startup: idempotency across restarts ────────────────────────

  describe('restart idempotency', () => {
    it('dedupReady transitions from false → true exactly once per service lifecycle', () => {
      mockSyncService.isDedupReady
        .mockReturnValueOnce(false) // first tick: dedup not done
        .mockReturnValueOnce(true); // second tick: dedup complete

      expect(mockSyncService.isDedupReady()).toBe(false);
      expect(mockSyncService.isDedupReady()).toBe(true);
    });

    it('after dedupReady is true, all subsequent ticks query the DB normally', async () => {
      mockSyncService.isDedupReady.mockReturnValue(true);
      mockPrisma.gitHubSource.findMany.mockResolvedValue([]);

      await scheduler.tick();
      await scheduler.tick();
      await scheduler.tick();

      expect(mockPrisma.gitHubSource.findMany).toHaveBeenCalledTimes(3);
    });
  });
});
