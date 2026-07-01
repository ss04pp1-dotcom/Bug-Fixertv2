import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubSyncService } from '../github-sync/github-sync.service';
import { CreateGitHubSourceDto, UpdateGitHubSourceDto } from './dto/create-github-source.dto';

@Injectable()
export class GitHubSourcesService {
  private readonly logger = new Logger(GitHubSourcesService.name);

  constructor(
    private prisma: PrismaService,
    private syncService: GitHubSyncService,
  ) {}

  async findAll() {
    const sources = await this.prisma.gitHubSource.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { syncLogs: true } },
        syncLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, added: true, updated: true, deleted: true, durationMs: true, errorMessage: true, startedAt: true },
        },
      },
    });
    return sources;
  }

  async findOne(id: string) {
    const source = await this.prisma.gitHubSource.findUnique({
      where: { id },
      include: {
        syncLogs: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!source) throw new NotFoundException('GitHub source not found');
    return source;
  }

  async create(dto: CreateGitHubSourceDto) {
    const existing = await this.prisma.gitHubSource.findFirst({ where: { url: dto.url } });
    if (existing) throw new ConflictException('A source with this URL already exists');

    const source = await this.prisma.gitHubSource.create({
      data: {
        name: dto.name,
        url: dto.url,
        enabled: dto.enabled ?? true,
        syncIntervalMinutes: dto.syncIntervalMinutes ?? 10,
        cookie:    dto.cookie    ?? null,
        userAgent: dto.userAgent ?? null,
        referer:   dto.referer   ?? null,
        origin:    dto.origin    ?? null,
      },
    });

    if (source.enabled) {
      // A-064: don't silently swallow sync errors — log them so admin can see what went wrong.
      this.syncService.syncSource(source.id).catch((err: Error) =>
        this.logger.error(`Sync failed for source ${source.id} (${source.name}): ${err.message}`, err.stack),
      );
    }

    return source;
  }

  async update(id: string, dto: UpdateGitHubSourceDto) {
    await this.findOne(id);
    return this.prisma.gitHubSource.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft-delete all servers from this source first
    await this.prisma.channelServer.updateMany({
      where: { githubSourceId: id },
      data: { deletedAt: new Date() },
    });
    await this.prisma.gitHubSource.delete({ where: { id } });
    return { message: 'GitHub source deleted' };
  }

  async syncNow(id: string, force = false) {
    const source = await this.findOne(id);
    if (source.isSyncing) return { message: 'Sync already in progress' };

    // Force re-fetch by clearing the cached ETag and Last-Modified headers
    // so the server won't skip processing when content appears unchanged.
    if (force) {
      await this.prisma.gitHubSource.update({
        where: { id },
        data: { etag: null, lastModified: null },
      });
    }

    // A-064: don't silently swallow sync errors — log them so admin can see what went wrong.
    this.syncService.syncSource(id).catch((err: Error) =>
      this.logger.error(`Sync failed for source ${id}: ${err.message}`, err.stack),
    );
    return { message: force ? 'Force sync started (ETag cleared)' : 'Sync started' };
  }

  async syncAll(force = false) {
    const sources = await this.prisma.gitHubSource.findMany({
      where: { enabled: true },
      select: { id: true, name: true, isSyncing: true },
    });

    if (force) {
      const ids = sources.map(s => s.id);
      await this.prisma.gitHubSource.updateMany({
        where: { id: { in: ids } },
        data: { etag: null, lastModified: null },
      });
    }

    const results: { id: string; name: string; status: string }[] = [];
    for (const src of sources) {
      if (src.isSyncing) {
        results.push({ id: src.id, name: src.name, status: 'already_syncing' });
        continue;
      }
      this.syncService.syncSource(src.id).catch((err: Error) =>
        this.logger.error(`Sync failed for source ${src.id} (${src.name}): ${err.message}`, err.stack),
      );
      results.push({ id: src.id, name: src.name, status: force ? 'force_sync_started' : 'sync_started' });
    }

    return { triggered: results.length, results };
  }

  async getLogs(id: string, limit = 50) {
    await this.findOne(id);
    return this.prisma.gitHubSyncLog.findMany({
      where: { githubSourceId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
