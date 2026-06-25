import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

export class CreateAnnouncementDto {
  title: string;
  message: string;
  type?: string;
  priority?: number;
  imageUrl?: string;
  deepLink?: string;
  isDismissible?: boolean;
  targetAll?: boolean;
  country?: string;
  language?: string;
  isPremium?: boolean;
  startsAt?: Date;
  expiresAt?: Date;
  isActive?: boolean;
}

@Injectable()
export class AnnouncementsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.announcement.findMany({ skip: query.skip, take: query.limit || 20, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }] }),
      this.prisma.announcement.count(),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async getActive() {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
      },
      orderBy: [{ priority: 'desc' }],
    });
  }

  async findOne(id: string) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Announcement not found');
    return a;
  }

  async create(dto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateAnnouncementDto>) {
    await this.findOne(id);
    return this.prisma.announcement.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.announcement.delete({ where: { id } });
    return { message: 'Announcement deleted' };
  }
}
