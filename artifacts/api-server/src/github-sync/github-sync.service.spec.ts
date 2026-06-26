import { Test, TestingModule } from '@nestjs/testing';
import { GitHubSyncService, normalizeName } from './github-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubSyncStatus } from '@prisma/client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeChannel(overrides: Partial<{
  id: string; normalizedName: string; slug: string;
  githubChannelId: string | null;
  adminNameOverride: string | null;
  adminLogoOverride: string | null;
}> = {}) {
  return {
    id: 'channel-1',
    normalizedName: 'sony hd',
    slug: 'sony-hd',
    githubChannelId: null,
    adminNameOverride: null,
    adminLogoOverride: null,
    ...overrides,
  };
}

function makeServer(overrides: Partial<{
  id: string; channelId: string; link: string;
  githubSourceId: string | null; githubChannelId: string | null;
  deletedAt: Date | null;
}> = {}) {
  return {
    id: 'server-1',
    channelId: 'channel-1',
    link: 'http://stream.example.com/ch',
    githubSourceId: 'source-1',
    githubChannelId: null,
    deletedAt: null,
    ...overrides,
  };
}

function makeSource(overrides: Partial<{
  id: string; name: string; url: string;
  isSyncing: boolean; syncStartedAt: Date | null;
  etag: string | null; lastModified: string | null;
}> = {}) {
  return {
    id: 'source-1',
    name: 'Test Source',
    url: 'https://example.com/playlist.m3u',
    isSyncing: false,
    syncStartedAt: null,
    etag: null,
    lastModified: null,
    ...overrides,
  };
}

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockPrisma = {
  $queryRaw:   jest.fn(),
  $executeRaw: jest.fn(),
  channel: {
    findMany:   jest.fn(),
    findFirst:  jest.fn(),
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
  },
  channelServer: {
    findMany:   jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    updateMany: jest.fn(),
    count:      jest.fn(),
    groupBy:    jest.fn(),
  },
  channelMergeLog: { create: jest.fn() },
  gitHubSource:    { findUnique: jest.fn(), update: jest.fn() },
  gitHubSyncLog:   { create: jest.fn(), update: jest.fn() },
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('GitHubSyncService', () => {
  let service: GitHubSyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubSyncService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<GitHubSyncService>(GitHubSyncService);
    jest.clearAllMocks();

    // Safe defaults so every test can opt-in to only the mocks it needs
    mockPrisma.$executeRaw.mockResolvedValue(BigInt(0));
    mockPrisma.channelMergeLog.create.mockResolvedValue({});
    mockPrisma.gitHubSource.update.mockResolvedValue({});
    mockPrisma.gitHubSyncLog.create.mockResolvedValue({ id: 'log-1' });
    mockPrisma.gitHubSyncLog.update.mockResolvedValue({});
    mockPrisma.channelServer.updateMany.mockResolvedValue({});
    mockPrisma.channelServer.count.mockResolvedValue(0);
    mockPrisma.channelServer.groupBy.mockResolvedValue([]);
  });

  // ── normalizeName ──────────────────────────────────────────────────────────
  describe('normalizeName()', () => {
    // Scenario 3: capitalization variants
    it.each([
      ['Sony HD',  'sony hd'],
      ['SONY HD',  'sony hd'],
      ['sony hd',  'sony hd'],
      ['SoNy Hd',  'sony hd'],
    ])('normalises "%s" → "%s" (capitalisation)', (input, expected) => {
      expect(normalizeName(input)).toBe(expected);
    });

    // Scenario 4: separator variants
    it.each([
      ['Sony-HD',   'sony hd'],
      ['Sony_HD',   'sony hd'],
      ['Sony HD',   'sony hd'],
      ['Sony.HD',   'sony hd'],
      ['Sony--HD',  'sony hd'],
      ['Sony__HD',  'sony hd'],
      ['Sony  HD',  'sony hd'],
      ['Sony-_HD',  'sony hd'],
      ['Sony.-_HD', 'sony hd'],
    ])('normalises "%s" → "%s" (separators)', (input, expected) => {
      expect(normalizeName(input)).toBe(expected);
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeName('  sony hd  ')).toBe('sony hd');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(normalizeName('   ')).toBe('');
    });

    it('combines capitalisation and separator normalisation', () => {
      expect(normalizeName('SONY-HD_Channel')).toBe('sony hd channel');
    });
  });

  // ── onModuleInit / isDedupReady ────────────────────────────────────────────
  describe('onModuleInit()', () => {
    it('starts with dedupReady = false', () => {
      expect(service.isDedupReady()).toBe(false);
    });

    it('sets dedupReady to true after successful dedup', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      await service.onModuleInit();
      expect(service.isDedupReady()).toBe(true);
    });

    it('sets dedupReady to true even when dedup throws (never blocks start)', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB offline'));
      await service.onModuleInit();
      expect(service.isDedupReady()).toBe(true);
    });

    it('never propagates errors — onModuleInit always resolves', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('fatal'));
      await expect(service.onModuleInit()).resolves.toBeUndefined();
    });
  });

  // ── deduplicateExistingChannels ────────────────────────────────────────────
  describe('deduplicateExistingChannels()', () => {
    it('returns early without calling merge when no duplicate groups exist', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      const spy = jest.spyOn(service, 'mergeDuplicateGroup');
      await service.deduplicateExistingChannels();
      expect(spy).not.toHaveBeenCalled();
    });

    it('calls mergeDuplicateGroup once per group with correct args', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { normalizedName: 'sony hd', ids: ['c1', 'c2'] },
        { normalizedName: 'cnn',     ids: ['c3', 'c4', 'c5'] },
      ]);
      const spy = jest.spyOn(service, 'mergeDuplicateGroup').mockResolvedValue(undefined);

      await service.deduplicateExistingChannels();

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith('sony hd', ['c1', 'c2'], 'startup');
      expect(spy).toHaveBeenCalledWith('cnn',     ['c3', 'c4', 'c5'], 'startup');
    });

    it('skips a failing group and continues with the rest (isolation)', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { normalizedName: 'bad-group', ids: ['c1', 'c2'] },
        { normalizedName: 'ok-group',  ids: ['c3', 'c4'] },
      ]);
      const spy = jest.spyOn(service, 'mergeDuplicateGroup')
        .mockRejectedValueOnce(new Error('DB error on group 1'))
        .mockResolvedValueOnce(undefined);

      await expect(service.deduplicateExistingChannels()).resolves.toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('is idempotent — second run finds no groups after first (soft-delete effect)', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ normalizedName: 'sony hd', ids: ['c1', 'c2'] }])
        .mockResolvedValueOnce([]); // duplicates gone after first merge

      const spy = jest.spyOn(service, 'mergeDuplicateGroup').mockResolvedValue(undefined);

      await service.deduplicateExistingChannels();
      await service.deduplicateExistingChannels();

      expect(spy).toHaveBeenCalledTimes(1); // only first run calls merge
    });
  });

  // ── mergeDuplicateGroup ────────────────────────────────────────────────────
  describe('mergeDuplicateGroup()', () => {
    const KEEP = 'keep-id';
    const DUP1 = 'dup1-id';
    const DUP2 = 'dup2-id';
    const NORM = 'sony hd';

    beforeEach(() => {
      mockPrisma.channelServer.update.mockResolvedValue({});
      mockPrisma.channel.updateMany.mockResolvedValue({});
    });

    it('returns immediately when ids has only one entry (no merge needed)', async () => {
      await service.mergeDuplicateGroup(NORM, [KEEP], 'startup');
      expect(mockPrisma.channelServer.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.channelMergeLog.create).not.toHaveBeenCalled();
    });

    it('moves unique servers from duplicate to keeper', async () => {
      mockPrisma.channelServer.findMany
        .mockResolvedValueOnce([makeServer({ id: 'sk1', channelId: KEEP,  link: 'http://url1', githubSourceId: 'srcA' })])
        .mockResolvedValueOnce([makeServer({ id: 'sd1', channelId: DUP1,  link: 'http://url2', githubSourceId: 'srcA', deletedAt: null })]);

      await service.mergeDuplicateGroup(NORM, [KEEP, DUP1], 'startup');

      expect(mockPrisma.channelServer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sd1' }, data: { channelId: KEEP } }),
      );
    });

    it('soft-deletes a server that is an exact duplicate of one already on keeper', async () => {
      const LINK = 'http://stream.example.com/sony';
      const SRC  = 'srcA';

      mockPrisma.channelServer.findMany
        .mockResolvedValueOnce([makeServer({ id: 'sk1', channelId: KEEP, link: LINK, githubSourceId: SRC })])
        .mockResolvedValueOnce([makeServer({ id: 'sd1', channelId: DUP1, link: LINK, githubSourceId: SRC, deletedAt: null })]);

      await service.mergeDuplicateGroup(NORM, [KEEP, DUP1], 'startup');

      expect(mockPrisma.channelServer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sd1' }, data: { deletedAt: expect.any(Date) } }),
      );
      // Must NOT reassign the duplicate server to keeper
      const reassignCall = mockPrisma.channelServer.update.mock.calls.find(
        (c: any[]) => c[0].where.id === 'sd1' && c[0].data.channelId === KEEP,
      );
      expect(reassignCall).toBeUndefined();
    });

    it('skips update entirely for already-soft-deleted duplicate server with same key', async () => {
      const LINK = 'http://stream.example.com/sony';
      const SRC  = 'srcA';

      mockPrisma.channelServer.findMany
        .mockResolvedValueOnce([makeServer({ id: 'sk1', channelId: KEEP, link: LINK, githubSourceId: SRC })])
        .mockResolvedValueOnce([makeServer({ id: 'sd1', channelId: DUP1, link: LINK, githubSourceId: SRC, deletedAt: new Date() })]);

      await service.mergeDuplicateGroup(NORM, [KEEP, DUP1], 'startup');

      const updatesForSd1 = mockPrisma.channelServer.update.mock.calls.filter(
        (c: any[]) => c[0].where?.id === 'sd1',
      );
      expect(updatesForSd1).toHaveLength(0); // already deleted — nothing to do
    });

    it('reassigns PlaybackEvents, EpgPrograms and Favorites via executeRaw', async () => {
      mockPrisma.channelServer.findMany.mockResolvedValue([]);

      await service.mergeDuplicateGroup(NORM, [KEEP, DUP1], 'startup');

      // Three executeRaw calls: playback_events, epg_programs, favorites (delete + update = 4 total)
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(4);
    });

    it('soft-deletes all duplicate channel rows (no hard delete)', async () => {
      mockPrisma.channelServer.findMany.mockResolvedValue([]);

      await service.mergeDuplicateGroup(NORM, [KEEP, DUP1, DUP2], 'startup');

      expect(mockPrisma.channel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: [DUP1, DUP2] } },
          data:  { deletedAt: expect.any(Date) },
        }),
      );
    });

    it('does NOT hard-delete any channel rows', async () => {
      mockPrisma.channelServer.findMany.mockResolvedValue([]);
      await service.mergeDuplicateGroup(NORM, [KEEP, DUP1], 'startup');

      const deleteChannelCalls = (mockPrisma.channel as any).delete?.mock?.calls ?? [];
      expect(deleteChannelCalls).toHaveLength(0);
    });

    it('writes a ChannelMergeLog audit entry with correct counts', async () => {
      const LINK_A = 'http://url-a'; // exists on keeper → deduplicated
      const LINK_B = 'http://url-b'; // unique → moved
      const SRC    = 'srcA';

      mockPrisma.channelServer.findMany
        .mockResolvedValueOnce([makeServer({ id: 'sk1', channelId: KEEP, link: LINK_A, githubSourceId: SRC })])
        .mockResolvedValueOnce([
          makeServer({ id: 'sd1', channelId: DUP1, link: LINK_A, githubSourceId: SRC, deletedAt: null }),
          makeServer({ id: 'sd2', channelId: DUP1, link: LINK_B, githubSourceId: SRC, deletedAt: null }),
        ]);

      await service.mergeDuplicateGroup(NORM, [KEEP, DUP1], 'startup');

      expect(mockPrisma.channelMergeLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            trigger:            'startup',
            normalizedName:     NORM,
            keptChannelId:      KEEP,
            mergedChannelIds:   [DUP1],
            serversMoved:       1,
            serversDeduplicated: 1,
          }),
        }),
      );
    });

    it('uses "manual" trigger when called with manual trigger argument', async () => {
      mockPrisma.channelServer.findMany.mockResolvedValue([]);
      await service.mergeDuplicateGroup(NORM, [KEEP, DUP1], 'manual');
      expect(mockPrisma.channelMergeLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ trigger: 'manual' }) }),
      );
    });

    it('is idempotent — second call on already-merged group moves no servers', async () => {
      // After first merge keeper has both servers; dup has none
      mockPrisma.channelServer.findMany
        .mockResolvedValueOnce([
          makeServer({ id: 'sk1', channelId: KEEP, link: 'http://url1', githubSourceId: 'srcA' }),
          makeServer({ id: 'sk2', channelId: KEEP, link: 'http://url2', githubSourceId: 'srcA' }),
        ])
        .mockResolvedValueOnce([]); // dup has no servers

      await service.mergeDuplicateGroup(NORM, [KEEP, DUP1], 'startup');

      expect(mockPrisma.channelServer.update).not.toHaveBeenCalled();
      expect(mockPrisma.channelMergeLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ serversMoved: 0, serversDeduplicated: 0 }),
        }),
      );
    });

    it('handles three duplicate channels in one group', async () => {
      mockPrisma.channelServer.findMany
        .mockResolvedValueOnce([]) // keeper: empty
        .mockResolvedValueOnce([
          makeServer({ id: 'sd1', channelId: DUP1, link: 'http://url1', githubSourceId: 'srcA', deletedAt: null }),
          makeServer({ id: 'sd2', channelId: DUP2, link: 'http://url2', githubSourceId: 'srcB', deletedAt: null }),
        ]);

      await service.mergeDuplicateGroup(NORM, [KEEP, DUP1, DUP2], 'startup');

      expect(mockPrisma.channel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: [DUP1, DUP2] } } }),
      );
      expect(mockPrisma.channelMergeLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ serversMoved: 2, serversDeduplicated: 0 }),
        }),
      );
    });
  });

  // ── processItem — dedup scenarios ─────────────────────────────────────────
  describe('processItem() — channel deduplication', () => {
    const SOURCE_ID = 'source-1';

    function makeStats() {
      return { added: 0, updated: 0, deleted: 0, failed: 0 };
    }

    /** Calls the private processItem directly */
    async function runItem(
      item:            { name: string; link: string; logo?: string; githubChannelId?: string },
      byNorm:          Map<string, string>,
      byGhId:          Map<string, string>,
      existingServers: any[],
      seenServerIds:   Set<string>,
      slugSet:         Set<string>,
      stats:           ReturnType<typeof makeStats>,
    ) {
      return (service as any).processItem(
        item, SOURCE_ID, existingServers, seenServerIds, byNorm, byGhId, slugSet, stats,
      );
    }

    beforeEach(() => {
      mockPrisma.channel.findFirst.mockResolvedValue(null);
      mockPrisma.channel.findUnique.mockResolvedValue({ adminNameOverride: null, adminLogoOverride: null });
      mockPrisma.channel.create.mockResolvedValue({ id: 'new-channel' });
      mockPrisma.channel.update.mockResolvedValue({});
      mockPrisma.channelServer.create.mockResolvedValue({ id: 'new-server' });
      mockPrisma.channelServer.update.mockResolvedValue({});
    });

    // ── Scenario 1 ──────────────────────────────────────────────────────────
    it('Scenario 1 — same name, different URLs → one channel, two servers', async () => {
      const byNorm = new Map<string, string>();
      const existingServers: any[] = [];
      const stats = makeStats();

      await runItem({ name: 'Sony HD', link: 'http://url1' }, byNorm, new Map(), existingServers, new Set(), new Set(), stats);
      await runItem({ name: 'Sony HD', link: 'http://url2' }, byNorm, new Map(), existingServers, new Set(), new Set(), stats);

      expect(mockPrisma.channel.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.channelServer.create).toHaveBeenCalledTimes(2);
      expect(stats.added).toBe(1);
    });

    // ── Scenario 2 ──────────────────────────────────────────────────────────
    it('Scenario 2 — same channel from two sources → one channel, two servers', async () => {
      const CHANNEL_ID = 'existing-channel';

      // byNorm already has the channel (Source A synced first and the channel
      // was loaded via channel.findMany at the start of applyChanges)
      const byNorm = new Map([['sony hd', CHANNEL_ID]]);

      // existingServers is filtered to THIS source — Source A's server is absent
      const existingServers: any[] = [];
      const seenServerIds = new Set<string>();

      await runItem(
        { name: 'Sony HD', link: 'http://url-source-b' },
        byNorm, new Map(), existingServers, seenServerIds, new Set(), makeStats(),
      );

      // No new channel created — reused the existing one
      expect(mockPrisma.channel.create).not.toHaveBeenCalled();
      // New server created under the shared channel
      expect(mockPrisma.channelServer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ channelId: CHANNEL_ID, link: 'http://url-source-b' }),
        }),
      );
    });

    // ── Scenario 3 ──────────────────────────────────────────────────────────
    it('Scenario 3 — different capitalisation resolves to the same channel', async () => {
      const byNorm = new Map<string, string>();
      const stats = makeStats();

      await runItem({ name: 'Sony HD',  link: 'http://url1' }, byNorm, new Map(), [], new Set(), new Set(), stats);
      await runItem({ name: 'SONY HD',  link: 'http://url2' }, byNorm, new Map(), [], new Set(), new Set(), stats);

      expect(mockPrisma.channel.create).toHaveBeenCalledTimes(1);
      expect(stats.added).toBe(1);
    });

    // ── Scenario 4 ──────────────────────────────────────────────────────────
    it.each([
      'Sony-HD', 'Sony_HD', 'Sony.HD', 'Sony  HD',
    ])('Scenario 4 — "%s" resolves to the same channel as "Sony HD"', async (variant) => {
      const byNorm = new Map<string, string>();
      const stats = makeStats();

      await runItem({ name: 'Sony HD', link: 'http://url1' }, byNorm, new Map(), [], new Set(), new Set(), stats);
      await runItem({ name: variant,   link: 'http://url2' }, byNorm, new Map(), [], new Set(), new Set(), stats);

      expect(mockPrisma.channel.create).toHaveBeenCalledTimes(1);
    });

    // ── Edge cases ──────────────────────────────────────────────────────────
    it('skips items whose name normalises to empty string', async () => {
      const stats = makeStats();
      await runItem({ name: '   ', link: 'http://url' }, new Map(), new Map(), [], new Set(), new Set(), stats);
      expect(mockPrisma.channel.create).not.toHaveBeenCalled();
      expect(mockPrisma.channelServer.create).not.toHaveBeenCalled();
    });

    it('adopts channel found by DB re-check (concurrent creation visible in DB)', async () => {
      // byNorm is empty (this source hasn't seen the channel yet), but the DB
      // already has it (a concurrent sync from another source created it)
      mockPrisma.channel.findFirst.mockResolvedValueOnce({ id: 'concurrent-channel' });

      await runItem({ name: 'Sony HD', link: 'http://url' }, new Map(), new Map(), [], new Set(), new Set(), makeStats());

      expect(mockPrisma.channel.create).not.toHaveBeenCalled();
      expect(mockPrisma.channelServer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ channelId: 'concurrent-channel' }),
        }),
      );
    });

    it('handles P2002 race condition — catches error and adopts the winner', async () => {
      mockPrisma.channel.findFirst
        .mockResolvedValueOnce(null)    // initial DB re-check: not found yet
        .mockResolvedValueOnce({ id: 'race-winner' }); // re-fetch after P2002

      const p2002 = Object.assign(new Error('Unique constraint violation'), { code: 'P2002' });
      mockPrisma.channel.create.mockRejectedValueOnce(p2002);

      await runItem({ name: 'Sony HD', link: 'http://url' }, new Map(), new Map(), [], new Set(), new Set(), makeStats());

      expect(mockPrisma.channelServer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ channelId: 'race-winner' }),
        }),
      );
    });

    it('propagates non-P2002 errors so processBatch can record them', async () => {
      mockPrisma.channel.findFirst.mockResolvedValue(null);
      mockPrisma.channel.create.mockRejectedValue(Object.assign(new Error('P2003 FK violation'), { code: 'P2003' }));

      await expect(
        runItem({ name: 'Sony HD', link: 'http://url' }, new Map(), new Map(), [], new Set(), new Set(), makeStats()),
      ).rejects.toThrow('P2003');
    });

    it('updates existing server by channelId+link instead of creating a duplicate', async () => {
      const CHANNEL_ID = 'existing-channel';
      const LINK       = 'http://url1';
      const SERVER_ID  = 'existing-server';

      const byNorm = new Map([['sony hd', CHANNEL_ID]]);
      const existingServers = [
        makeServer({ id: SERVER_ID, channelId: CHANNEL_ID, link: LINK, githubSourceId: SOURCE_ID }),
      ];

      await runItem({ name: 'Sony HD', link: LINK }, byNorm, new Map(), existingServers, new Set(), new Set(), makeStats());

      expect(mockPrisma.channelServer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SERVER_ID } }),
      );
      expect(mockPrisma.channelServer.create).not.toHaveBeenCalled();
    });

    // ── Admin override preservation ──────────────────────────────────────────
    it('does NOT overwrite channel name when adminNameOverride is set', async () => {
      const byNorm = new Map([['sony hd', 'existing-c']]);

      mockPrisma.channel.findUnique.mockResolvedValue({
        adminNameOverride: 'Sony HD (Admin)',
        adminLogoOverride: null,
      });

      await runItem({ name: 'SONY HD', link: 'http://url' }, byNorm, new Map(), [], new Set(), new Set(), makeStats());

      const updateData = mockPrisma.channel.update.mock.calls[0]?.[0]?.data ?? {};
      expect(updateData).not.toHaveProperty('name');
    });

    it('does NOT overwrite logo when adminLogoOverride is set', async () => {
      const byNorm = new Map([['sony hd', 'existing-c']]);

      mockPrisma.channel.findUnique.mockResolvedValue({
        adminNameOverride: null,
        adminLogoOverride: 'https://admin.com/logo.png',
      });

      await runItem(
        { name: 'Sony HD', link: 'http://url', logo: 'https://github.com/new-logo.png' },
        byNorm, new Map(), [], new Set(), new Set(), makeStats(),
      );

      const updateData = mockPrisma.channel.update.mock.calls[0]?.[0]?.data ?? {};
      expect(updateData).not.toHaveProperty('logo');
    });

    it('DOES update logo when adminLogoOverride is null', async () => {
      const byNorm = new Map([['sony hd', 'existing-c']]);

      mockPrisma.channel.findUnique.mockResolvedValue({
        adminNameOverride: null,
        adminLogoOverride: null,
      });

      await runItem(
        { name: 'Sony HD', link: 'http://url', logo: 'https://github.com/logo.png' },
        byNorm, new Map(), [], new Set(), new Set(), makeStats(),
      );

      const updateData = mockPrisma.channel.update.mock.calls[0]?.[0]?.data ?? {};
      expect(updateData.logo).toBe('https://github.com/logo.png');
    });

    it('deduplicates via githubChannelId across different name variants', async () => {
      const byGhId = new Map([['cnn-us', 'cnn-channel']]);

      mockPrisma.channel.findUnique.mockResolvedValue({ adminNameOverride: null, adminLogoOverride: null });

      await runItem(
        { name: 'CNN', link: 'http://url', githubChannelId: 'cnn-us' },
        new Map(), byGhId, [], new Set(), new Set(), makeStats(),
      );

      // Channel found via githubChannelId — no create or DB findFirst
      expect(mockPrisma.channel.create).not.toHaveBeenCalled();
      expect(mockPrisma.channel.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── applyChanges — batching and orphan cleanup ─────────────────────────────
  describe('applyChanges() — batch processing & performance', () => {
    const SOURCE_ID = 'source-1';

    function makeStats() {
      return { added: 0, updated: 0, deleted: 0, failed: 0 };
    }

    beforeEach(() => {
      mockPrisma.channelServer.findMany.mockResolvedValue([]);
      mockPrisma.channel.findMany.mockResolvedValue([]);
    });

    it('processes exactly 100 items in one batch', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ name: `Ch${i}`, link: `http://x/${i}` }));
      const itemSpy = jest.spyOn(service as any, 'processItem').mockResolvedValue(undefined);
      await (service as any).applyChanges(SOURCE_ID, items, makeStats());
      expect(itemSpy).toHaveBeenCalledTimes(100);
    });

    it('splits 250 items into 3 batches (100 + 100 + 50)', async () => {
      const items = Array.from({ length: 250 }, (_, i) => ({ name: `Ch${i}`, link: `http://x/${i}` }));
      const batchSpy  = jest.spyOn(service as any, 'processBatch');
      const itemSpy   = jest.spyOn(service as any, 'processItem').mockResolvedValue(undefined);
      await (service as any).applyChanges(SOURCE_ID, items, makeStats());
      expect(batchSpy).toHaveBeenCalledTimes(3);
      expect(itemSpy).toHaveBeenCalledTimes(250);
    });

    it('handles 10,000 channels (100 batches of 100) without error', async () => {
      const items = Array.from({ length: 10_000 }, (_, i) => ({ name: `Ch${i}`, link: `http://x/${i}` }));
      const itemSpy = jest.spyOn(service as any, 'processItem').mockResolvedValue(undefined);
      const stats = makeStats();
      await (service as any).applyChanges(SOURCE_ID, items, stats);
      expect(itemSpy).toHaveBeenCalledTimes(10_000);
    });

    it('soft-deletes stale servers not present in the latest fetch', async () => {
      const stale = makeServer({ id: 'stale-srv', channelId: 'c1', githubSourceId: SOURCE_ID });
      mockPrisma.channelServer.findMany.mockResolvedValue([stale]);
      jest.spyOn(service as any, 'processItem').mockResolvedValue(undefined);

      const stats = makeStats();
      await (service as any).applyChanges(SOURCE_ID, [], stats); // no new items

      expect(mockPrisma.channelServer.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['stale-srv'] } },
          data:  { deletedAt: expect.any(Date) },
        }),
      );
      expect(stats.deleted).toBe(1);
    });

    it('does not soft-delete a server that is still present in the fetch', async () => {
      const active = makeServer({ id: 'active-srv', channelId: 'c1', githubSourceId: SOURCE_ID });
      mockPrisma.channelServer.findMany.mockResolvedValue([active]);
      jest.spyOn(service as any, 'processItem').mockImplementation(
        async (_item: any, _src: any, _existing: any, seenIds: Set<string>) => {
          seenIds.add('active-srv');
        },
      );

      const stats = makeStats();
      await (service as any).applyChanges(SOURCE_ID, [{ name: 'Ch', link: 'http://x' }], stats);

      expect(stats.deleted).toBe(0);
    });

    it('processItem failure increments stats.failed without stopping the batch', async () => {
      jest.spyOn(service as any, 'processItem')
        .mockRejectedValueOnce(new Error('bad item'))
        .mockResolvedValue(undefined);

      const stats = makeStats();
      await (service as any).applyChanges(SOURCE_ID, [
        { name: 'Bad',  link: 'http://bad' },
        { name: 'Good', link: 'http://good' },
      ], stats);

      expect(stats.failed).toBe(1);
    });
  });

  // ── syncSource ─────────────────────────────────────────────────────────────
  describe('syncSource()', () => {
    const SOURCE_ID = 'source-1';

    beforeEach(() => {
      mockPrisma.gitHubSource.findUnique.mockResolvedValue(makeSource());
      mockPrisma.channelServer.findMany.mockResolvedValue([]);
      mockPrisma.channel.findMany.mockResolvedValue([]);
      mockPrisma.channelServer.groupBy.mockResolvedValue([]);
      mockPrisma.channelServer.count.mockResolvedValue(0);
    });

    it('returns immediately when source does not exist', async () => {
      mockPrisma.gitHubSource.findUnique.mockResolvedValue(null);
      await service.syncSource(SOURCE_ID);
      expect(mockPrisma.gitHubSyncLog.create).not.toHaveBeenCalled();
    });

    it('skips a source that is actively syncing within the stale window', async () => {
      mockPrisma.gitHubSource.findUnique.mockResolvedValue(
        makeSource({ isSyncing: true, syncStartedAt: new Date() }),
      );
      await service.syncSource(SOURCE_ID);
      expect(mockPrisma.gitHubSyncLog.create).not.toHaveBeenCalled();
    });

    it('proceeds when isSyncing is true but syncStartedAt is > 10 minutes ago (stale lock)', async () => {
      mockPrisma.gitHubSource.findUnique.mockResolvedValue(
        makeSource({ isSyncing: true, syncStartedAt: new Date(Date.now() - 11 * 60_000) }),
      );
      global.fetch = jest.fn().mockResolvedValue({
        status: 304, ok: true, headers: { get: () => null },
      } as any);

      await service.syncSource(SOURCE_ID);
      expect(mockPrisma.gitHubSyncLog.create).toHaveBeenCalled();
    });

    it('records status=success for a 304 ETag hit (content unchanged)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 304, ok: true, headers: { get: () => null },
      } as any);

      await service.syncSource(SOURCE_ID);

      expect(mockPrisma.gitHubSyncLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: GitHubSyncStatus.success }),
        }),
      );
    });

    it('records status=failed and increments consecutiveFailures on network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      await service.syncSource(SOURCE_ID);

      expect(mockPrisma.gitHubSyncLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: GitHubSyncStatus.failed }) }),
      );
      expect(mockPrisma.gitHubSource.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ consecutiveFailures: { increment: 1 } }) }),
      );
    });

    it('records status=failed on non-2xx HTTP response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        status: 503, ok: false, statusText: 'Service Unavailable',
        headers: { get: () => null },
      } as any);

      await service.syncSource(SOURCE_ID);

      expect(mockPrisma.gitHubSyncLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: GitHubSyncStatus.failed }) }),
      );
    });

    it('parses a valid M3U response and creates channel + server rows', async () => {
      const m3u = '#EXTM3U\n#EXTINF:-1 tvg-logo="http://logo.com/l.png",Test Channel\nhttp://stream.test/live';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200, ok: true,
        text: () => Promise.resolve(m3u),
        headers: { get: () => null },
      } as any);

      mockPrisma.channel.findFirst.mockResolvedValue(null);
      mockPrisma.channel.create.mockResolvedValue({ id: 'new-ch' });
      mockPrisma.channelServer.create.mockResolvedValue({ id: 'new-srv' });

      await service.syncSource(SOURCE_ID);

      expect(mockPrisma.channel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ normalizedName: 'test channel' }),
        }),
      );
    });

    it('does NOT overwrite channel name when adminNameOverride is set', async () => {
      const m3u = '#EXTM3U\n#EXTINF:-1,Sony HD\nhttp://stream.test/sony';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200, ok: true,
        text: () => Promise.resolve(m3u),
        headers: { get: () => null },
      } as any);

      mockPrisma.channel.findMany.mockResolvedValue([
        makeChannel({ id: 'c1', normalizedName: 'sony hd', slug: 'sony-hd' }),
      ]);
      mockPrisma.channel.findFirst.mockResolvedValue(null);
      mockPrisma.channel.findUnique.mockResolvedValue({
        adminNameOverride: 'Sony HD (Admin Curated)',
        adminLogoOverride: null,
      });

      await service.syncSource(SOURCE_ID);

      const updateCalls = mockPrisma.channel.update.mock.calls as any[][];
      for (const [arg] of updateCalls) {
        expect(arg.data).not.toHaveProperty('name');
      }
    });

    it('does NOT overwrite logo when adminLogoOverride is set', async () => {
      const m3u = '#EXTM3U\n#EXTINF:-1 tvg-logo="http://github.com/new.png",Sony HD\nhttp://stream.test/sony';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200, ok: true,
        text: () => Promise.resolve(m3u),
        headers: { get: () => null },
      } as any);

      mockPrisma.channel.findMany.mockResolvedValue([
        makeChannel({ id: 'c1', normalizedName: 'sony hd', slug: 'sony-hd' }),
      ]);
      mockPrisma.channel.findFirst.mockResolvedValue(null);
      mockPrisma.channel.findUnique.mockResolvedValue({
        adminNameOverride: null,
        adminLogoOverride: 'https://admin.com/curated-logo.png',
      });

      await service.syncSource(SOURCE_ID);

      const updateCalls = mockPrisma.channel.update.mock.calls as any[][];
      for (const [arg] of updateCalls) {
        expect(arg.data).not.toHaveProperty('logo');
      }
    });

    it('normalizedName is always written to the update even when name/logo are overridden', async () => {
      const m3u = '#EXTM3U\n#EXTINF:-1,SONY HD\nhttp://stream.test/sony';
      global.fetch = jest.fn().mockResolvedValue({
        status: 200, ok: true,
        text: () => Promise.resolve(m3u),
        headers: { get: () => null },
      } as any);

      mockPrisma.channel.findMany.mockResolvedValue([
        makeChannel({ id: 'c1', normalizedName: 'sony hd', slug: 'sony-hd' }),
      ]);
      mockPrisma.channel.findFirst.mockResolvedValue(null);
      mockPrisma.channel.findUnique.mockResolvedValue({
        adminNameOverride: 'Sony HD (Admin)',
        adminLogoOverride: 'https://admin.com/logo.png',
      });

      await service.syncSource(SOURCE_ID);

      const updateCalls = mockPrisma.channel.update.mock.calls as any[][];
      const hasNormalizedName = updateCalls.some(([arg]) => arg.data?.normalizedName === 'sony hd');
      expect(hasNormalizedName).toBe(true);
    });
  });
});
