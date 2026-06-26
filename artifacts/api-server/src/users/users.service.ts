import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const ROLE_LEVEL: Record<string, number> = {
  super_admin: 5, admin: 4, moderator: 3, support: 2, user: 1,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const { skip, limit = 20, page = 1, search, sortBy, sortOrder = 'desc', isActive } = query;
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const allowedSortFields: Record<string, boolean> = {
      createdAt: true, name: true, email: true, updatedAt: true,
    };
    const orderByField = sortBy && allowedSortFields[sortBy] ? sortBy : 'createdAt';
    const orderBy = { [orderByField]: sortOrder } as Prisma.UserOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true, name: true, email: true, phone: true, role: true,
          isActive: true, isPremium: true, country: true, language: true,
          emailVerified: true, phoneVerified: true, createdAt: true, updatedAt: true,
          avatar: true, subscriptionEndsAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: paginate(total, page, limit) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: {
        subscription: { include: { plan: true } },
        sessions: {
          where: { isActive: true },
          select: { id: true, deviceName: true, deviceType: true, platform: true, ipAddress: true, createdAt: true, expiresAt: true, isActive: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash: _hash, ...rest } = user;
    return rest;
  }

  async create(dto: CreateUserDto) {
    const orConditions: Array<{ email: string } | { phone: string }> = [];
    if (dto.email) orConditions.push({ email: dto.email });
    if (dto.phone) orConditions.push({ phone: dto.phone });
    if (orConditions.length > 0) {
      const existing = await this.prisma.user.findFirst({ where: { OR: orConditions } });
      if (existing) throw new ConflictException('User already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: (dto.role as UserRole) ?? UserRole.user,
        country: dto.country,
        language: dto.language ?? 'en',
      },
    });
    const { passwordHash: _hash, ...rest } = user;
    return rest;
  }

  async update(id: string, dto: UpdateUserDto, callerRole?: string) {
    await this.findOne(id);
    if (dto.email) {
      const emailConflict = await this.prisma.user.findFirst({
        where: { email: dto.email, id: { not: id }, deletedAt: null },
      });
      if (emailConflict) throw new ConflictException('Email already in use');
    }
    if (dto.phone) {
      const phoneConflict = await this.prisma.user.findFirst({
        where: { phone: dto.phone, id: { not: id }, deletedAt: null },
      });
      if (phoneConflict) throw new ConflictException('Phone number already in use');
    }
    const { role: _r, ...dtoRest } = dto;
    let roleUpdate: { role?: UserRole } = {};
    if (dto.role) {
      const callerLevel  = ROLE_LEVEL[callerRole ?? 'user'] ?? 1;
      const targetLevel  = ROLE_LEVEL[dto.role]              ?? 1;
      if (callerRole !== 'super_admin' && targetLevel >= callerLevel) {
        throw new ForbiddenException(`Cannot assign role '${dto.role}' — insufficient privileges`);
      }
      roleUpdate = { role: dto.role as UserRole };
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...dtoRest, ...roleUpdate } as Prisma.UserUpdateInput,
    });
    const { passwordHash: _hash, ...userRest } = user;
    return userRest;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { message: 'User deleted successfully' };
  }

  async getStats() {
    const [total, active, premium, today] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.user.count({ where: { deletedAt: null, isPremium: true } }),
      this.prisma.user.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);
    return { total, active, premium, newToday: today };
  }
}
