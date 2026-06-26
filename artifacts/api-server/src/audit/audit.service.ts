import { Injectable } from '@nestjs/common';
import { Prisma, AuditLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

export class CreateAuditLogDto {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  level?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { userId?: string; resource?: string; level?: string; search?: string }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (query.userId) where.userId = query.userId;
    if (query.resource) where.resource = query.resource;
    if (query.level && (Object.values(AuditLevel) as string[]).includes(query.level)) {
      where.level = query.level as AuditLevel;
    }
    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { resource: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, skip: query.skip, take: query.limit || 20,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async log(dto: CreateAuditLogDto) {
    return this.prisma.auditLog.create({ data: { ...dto, level: (dto.level as AuditLevel) ?? AuditLevel.info } });
  }
}
