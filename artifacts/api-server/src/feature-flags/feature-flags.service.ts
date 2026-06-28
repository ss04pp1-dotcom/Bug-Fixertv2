import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FeatureFlagsService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.featureFlag.findMany({ orderBy: { name: 'asc' } });
  }

  async getEnabled() {
    // A-058: cap at 20 + sort deterministically. Public feature-flag lookup
    // shouldn't return hundreds of rows; the most-recently-created enabled flags
    // are usually the most relevant for the mobile config payload.
    const flags = await this.prisma.featureFlag.findMany({
      where: { isEnabled: true },
      orderBy: [{ createdAt: 'desc' }],
      take: 20,
    });
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
    // A-065: previously this used `.catch(() => {})` to silently swallow the
    // P2025 not-found error, which meant deleting a non-existent flag returned
    // a 200 OK with "deleted" — misleading the admin into thinking they removed
    // a real flag. Verify existence first and 404 if missing.
    const existing = await this.prisma.featureFlag.findUnique({ where: { name } });
    if (!existing) throw new NotFoundException('Feature flag not found');
    await this.prisma.featureFlag.delete({ where: { name } });
    return { message: 'Feature flag deleted' };
  }
}
