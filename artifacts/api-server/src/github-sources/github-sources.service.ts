import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GitHubSyncService } from '../github-sync/github-sync.service';
import { CreateGitHubSourceDto, UpdateGitHubSourceDto } from './dto/create-github-source.dto';

@Injectable()
export class GitHubSourcesService {
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
      },
    });

    if (source.enabled) {
      this.syncService.syncSource(source.id).catch(() => {});
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

  async syncNow(id: string) {
    const source = await this.findOne(id);
    if (source.isSyncing) return { message: 'Sync already in progress' };
    this.syncService.syncSource(id).catch(() => {});
    return { message: 'Sync started' };
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
