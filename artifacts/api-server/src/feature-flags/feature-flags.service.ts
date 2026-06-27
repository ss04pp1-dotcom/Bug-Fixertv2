import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeatureFlagsService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.featureFlag.findMany({ orderBy: { name: 'asc' } });
  }

  async getEnabled() {
    const flags = await this.prisma.featureFlag.findMany({ where: { isEnabled: true } });
    const result: Record<string, boolean> = {};
    for (const f of flags) result[f.name] = true;
    return result;
  }

  async get(name: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name } });
    if (!flag) return { name, isEnabled: false };
    return flag;
  }

  async set(name: string, isEnabled: boolean, description?: string, roles?: string[]) {
    return this.prisma.featureFlag.upsert({
      where: { name },
      create: { name, isEnabled, description, roles: roles || [] },
      update: { isEnabled, ...(description && { description }), ...(roles && { roles }) },
    });
  }

  async toggle(name: string) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name } });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return this.prisma.featureFlag.update({ where: { name }, data: { isEnabled: !flag.isEnabled } });
  }

  async delete(name: string) {
    await this.prisma.featureFlag.delete({ where: { name } }).catch(() => {});
    return { message: 'Feature flag deleted' };
  }
}
