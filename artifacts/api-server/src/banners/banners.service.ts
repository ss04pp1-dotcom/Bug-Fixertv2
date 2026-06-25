import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

export class CreateBannerDto {
  title: string;
  imageUrl?: string;
  link?: string;
  position?: string;
  isActive?: boolean;
  priority?: number;
  startsAt?: Date;
  expiresAt?: Date;
}

@Injectable()
export class BannersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.banner.findMany({
        skip: query.skip,
        take: query.limit || 20,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.banner.count(),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async findActive() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
      },
      orderBy: [{ priority: 'desc' }],
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');
    return banner;
  }

  async create(dto: CreateBannerDto) {
    return this.prisma.banner.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateBannerDto>) {
    await this.findOne(id);
    return this.prisma.banner.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.banner.delete({ where: { id } });
    return { message: 'Banner deleted' };
  }
}
