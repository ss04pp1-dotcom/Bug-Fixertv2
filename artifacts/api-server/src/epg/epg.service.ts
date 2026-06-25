import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class CreateEpgDto {
  channelId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  category?: string;
  poster?: string;
  rating?: string;
}

@Injectable()
export class EpgService {
  constructor(private prisma: PrismaService) {}

  async getAllByDate(date?: string) {
    const start = date ? new Date(date) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const programs = await this.prisma.epgProgram.findMany({
      where: { startTime: { gte: start }, endTime: { lte: end } },
      orderBy: { startTime: 'asc' },
      include: { channel: { select: { id: true, name: true, logo: true } } },
    });

    type ProgramWithChannel = (typeof programs)[number];
    const grouped: Record<string, { channel: ProgramWithChannel['channel']; programs: ProgramWithChannel[] }> = {};
    for (const p of programs) {
      const cid = p.channelId;
      if (!grouped[cid]) grouped[cid] = { channel: p.channel, programs: [] };
      grouped[cid].programs.push(p);
    }
    return Object.values(grouped);
  }

  async getForChannel(channelId: string, date?: string) {
    const start = date ? new Date(date) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return this.prisma.epgProgram.findMany({
      where: { channelId, startTime: { gte: start }, endTime: { lte: end } },
      orderBy: { startTime: 'asc' },
    });
  }

  async getCurrentAndNext(channelId: string) {
    const now = new Date();
    const programs = await this.prisma.epgProgram.findMany({
      where: { channelId, endTime: { gte: now } },
      orderBy: { startTime: 'asc' },
      take: 2,
    });
    return { current: programs[0] || null, next: programs[1] || null };
  }

  async create(dto: CreateEpgDto) {
    return this.prisma.epgProgram.create({ data: dto });
  }

  async bulkCreate(programs: CreateEpgDto[]) {
    return this.prisma.epgProgram.createMany({ data: programs });
  }

  async update(id: string, dto: Partial<CreateEpgDto>) {
    return this.prisma.epgProgram.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.epgProgram.delete({ where: { id } });
    return { message: 'EPG program deleted' };
  }

  async clearForChannel(channelId: string) {
    await this.prisma.epgProgram.deleteMany({ where: { channelId } });
    return { message: 'EPG cleared for channel' };
  }
}
