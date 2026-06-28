import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeoBlockService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.geoRestriction.findMany({ orderBy: { countryCode: 'asc' } });
  }

  async isBlocked(countryCode: string) {
    // A-045: deny-by-default for unknown country codes. Previously a request with no
    // country header (or one we don't have an explicit GeoRestriction row for) was
    // allowed through — which means a misconfigured proxy or direct connection from
    // a sanctioned region would bypass geo-blocking entirely. The controller now
    // sends 'UNKNOWN' for missing headers; treat it as blocked.
    if (countryCode === 'UNKNOWN') {
      return { countryCode, isBlocked: true };
    }
    const restriction = await this.prisma.geoRestriction.findUnique({ where: { countryCode } });
    return { countryCode, isBlocked: restriction?.isBlocked ?? false };
  }

  async set(countryCode: string, isBlocked: boolean, reason?: string) {
    return this.prisma.geoRestriction.upsert({
      where: { countryCode },
      create: { countryCode, isBlocked, reason },
      update: { isBlocked, reason },
    });
  }

  async remove(countryCode: string) {
    await this.prisma.geoRestriction.delete({ where: { countryCode } })
      .catch((e: Error) => { throw new NotFoundException(`Geo restriction for "${countryCode}" not found: ${e.message}`); });
    return { message: 'Geo restriction removed' };
  }
}
