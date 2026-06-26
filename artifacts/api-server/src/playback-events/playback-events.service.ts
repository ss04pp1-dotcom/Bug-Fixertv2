import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportPlaybackDto } from './dto/report-playback.dto';

@Injectable()
export class PlaybackEventsService {
  constructor(private prisma: PrismaService) {}

  async report(dto: ReportPlaybackDto) {
    return this.prisma.playbackEvent.create({ data: dto as any });
  }

  async getChannelStats(channelId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = await this.prisma.playbackEvent.findMany({
      where: { channelId, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const successCount = events.filter(e => e.success).length;
    const failureCount = events.filter(e => !e.success).length;
    const total = successCount + failureCount;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : null;
    const lastSuccess = events.find(e => e.success)?.createdAt ?? null;
    const lastFailure = events.find(e => !e.success)?.createdAt ?? null;

    let playbackHealth = 'unknown';
    if (successRate !== null) {
      if (successRate >= 80) playbackHealth = 'healthy';
      else if (successRate >= 50) playbackHealth = 'unstable';
      else playbackHealth = 'offline';
    }

    return { successCount, failureCount, total, successRate, playbackHealth, lastSuccess, lastFailure };
  }

  async getEffectiveHealth(channelId: string, healthMode: string, healthOverride: string, streamStatus: string) {
    const stats = await this.getChannelStats(channelId);

    const serverHealth = streamStatus === 'active' ? 'healthy' : streamStatus;

    if (healthOverride === 'FORCE_HEALTHY') {
      return { ...stats, serverHealth, effectiveHealth: 'healthy', overrideMode: 'FORCE_HEALTHY', healthMode };
    }
    if (healthOverride === 'FORCE_OFFLINE') {
      return { ...stats, serverHealth, effectiveHealth: 'offline', overrideMode: 'FORCE_OFFLINE', healthMode };
    }

    let effectiveHealth: string;
    if (healthMode === 'SERVER') {
      effectiveHealth = serverHealth;
    } else if (healthMode === 'USER_PLAYBACK') {
      effectiveHealth = stats.playbackHealth === 'unknown' ? 'healthy' : stats.playbackHealth;
    } else {
      effectiveHealth = 'unknown';
    }

    return { ...stats, serverHealth, effectiveHealth, overrideMode: 'AUTO', healthMode };
  }
}
