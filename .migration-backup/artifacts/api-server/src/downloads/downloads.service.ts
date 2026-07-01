import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, DownloadStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreateDownloadDto } from './dto/create-download.dto';
import { UpdateDownloadDto } from './dto/update-download.dto';

@Injectable()
export class DownloadsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string, query: PaginationDto & { contentType?: string; status?: string }) {
    const where: Prisma.DownloadWhereInput = { userId };

    if (query.contentType) {
      (where as Prisma.DownloadWhereInput & { contentType?: string }).contentType = query.contentType;
    }

    if (query.status) {
      (where as Prisma.DownloadWhereInput & { status?: string }).status = query.status;
    }

    const { skip, limit = 20, page = 1 } = query;

    const [data, total] = await Promise.all([
      this.prisma.download.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.download.count({ where }),
    ]);

    return { data, meta: paginate(total, page, limit) };
  }

  async getStats(userId: string) {
    const [total, completed, pending, sizeAgg] = await Promise.all([
      this.prisma.download.count({ where: { userId } }),
      this.prisma.download.count({ where: { userId, status: 'completed' } }),
      this.prisma.download.count({ where: { userId, status: 'pending' } }),
      this.prisma.download.aggregate({
        _sum: { fileSize: true },
        where: { userId, status: 'completed' },
      }),
    ]);

    return {
      total,
      completed,
      pending,
      totalSizeUsed: sizeAgg._sum.fileSize ?? 0,
    };
  }

  async create(userId: string, dto: CreateDownloadDto) {
    return this.prisma.download.create({
      data: {
        userId,
        contentType: dto.contentType,
        contentId: dto.contentId,
        title: dto.title,
        poster: dto.poster,
        streamUrl: dto.streamUrl,
        quality: dto.quality,
        status: 'pending',
        progress: 0,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateDownloadDto) {
    const download = await this.prisma.download.findFirst({ where: { id, userId } });
    if (!download) throw new NotFoundException('Download not found');

    const data: Prisma.DownloadUpdateInput = {};
    if (dto.progress !== undefined) data.progress = dto.progress;
    if (dto.status !== undefined) data.status = dto.status as DownloadStatus;
    if (dto.filePath !== undefined) data.filePath = dto.filePath;
    if (dto.fileSize !== undefined) data.fileSize = dto.fileSize;

    return this.prisma.download.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string) {
    const download = await this.prisma.download.findFirst({ where: { id, userId } });
    if (!download) throw new NotFoundException('Download not found');

    await this.prisma.download.delete({ where: { id } });
    return { message: 'Download deleted' };
  }

  async pause(userId: string, id: string) {
    const download = await this.prisma.download.findFirst({ where: { id, userId } });
    if (!download) throw new NotFoundException('Download not found');

    return this.prisma.download.update({
      where: { id },
      data: { status: 'paused' },
    });
  }

  async resume(userId: string, id: string) {
    const download = await this.prisma.download.findFirst({ where: { id, userId } });
    if (!download) throw new NotFoundException('Download not found');

    return this.prisma.download.update({
      where: { id },
      data: { status: 'downloading' },
    });
  }

  async clearCompleted(userId: string) {
    const result = await this.prisma.download.deleteMany({
      where: { userId, status: 'completed' },
    });
    return { message: 'Completed downloads cleared', deleted: result.count };
  }

  async findAllAdmin(query: PaginationDto & { contentType?: string; status?: string; search?: string }) {
    const where: Prisma.DownloadWhereInput = {};
    if (query.contentType) where.contentType = query.contentType;
    if (query.status) where.status = query.status as DownloadStatus;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const { skip, limit = 20, page = 1 } = query;
    const [data, total] = await Promise.all([
      this.prisma.download.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.download.count({ where }),
    ]);
    return { data, meta: paginate(total, page, limit) };
  }

  async getAdminStats() {
    const [total, completed, inProgress, failed, sizeAgg] = await Promise.all([
      this.prisma.download.count(),
      this.prisma.download.count({ where: { status: 'completed' } }),
      this.prisma.download.count({ where: { status: { in: ['downloading', 'pending'] } } }),
      this.prisma.download.count({ where: { status: 'failed' } }),
      this.prisma.download.aggregate({ _sum: { fileSize: true }, where: { status: 'completed' } }),
    ]);
    const bytes = sizeAgg._sum.fileSize ?? 0;
    const storageUsed = bytes > 1_073_741_824
      ? `${(bytes / 1_073_741_824).toFixed(1)} GB`
      : bytes > 1_048_576
        ? `${(bytes / 1_048_576).toFixed(1)} MB`
        : `${(bytes / 1024).toFixed(1)} KB`;
    return { totalDownloads: total, completed, inProgress, failed, storageUsed };
  }
}