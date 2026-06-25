/**
 * DUAL ROLE SYSTEM — ARCHITECTURE NOTE
 *
 * This app has two parallel role mechanisms that serve different purposes:
 *
 * 1. `User.role` (UserRole enum in schema.prisma)
 *    - Values: super_admin | admin | moderator | editor | support | user
 *    - Used for ALL authentication & authorization (JwtStrategy, RolesGuard, JwtAuthGuard).
 *    - This is the authoritative source of truth for who can do what.
 *    - Changing a user's role means updating this enum field on the User row.
 *
 * 2. `Role` model + RolesService (this file)
 *    - A dynamic table managed via the Admin Panel → Roles screen.
 *    - Stores human-readable role descriptions and a permissions[] string array.
 *    - Used ONLY for display in the admin UI and informational permission strings.
 *    - It does NOT drive any guard or policy check — do NOT assume it does.
 *
 * To grant real access, always set User.role to the correct UserRole enum value.
 * The Role model records are display metadata only.
 */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { IsString, IsOptional, IsArray, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

export class CreateRoleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findFirst({ where: { OR: [{ id }, { name: id }] } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Role already exists');
    return this.prisma.role.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateRoleDto>) {
    await this.findOne(id);
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.isSystem) throw new ConflictException('Cannot delete system role');
    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted' };
  }

  getAvailablePermissions() {
    return [
      'users:read', 'users:write', 'users:delete',
      'channels:read', 'channels:write', 'channels:delete',
      'movies:read', 'movies:write', 'movies:delete',
      'series:read', 'series:write', 'series:delete',
      'subscriptions:read', 'subscriptions:write',
      'payments:read', 'payments:write',
      'notifications:read', 'notifications:write',
      'announcements:read', 'announcements:write',
      'advertisements:read', 'advertisements:write',
      'analytics:read', 'settings:read', 'settings:write',
      'roles:read', 'roles:write', 'audit:read',
    ];
  }
}
