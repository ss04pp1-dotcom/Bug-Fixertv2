import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../websocket/presence.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
  ) {}

  async getOverview() {
    // Live presence count (WebSocket) — synchronous in-memory read
    const activeUsers = this.presence.getOnlineCount();

    const [
      totalUsers, totalChannels, totalMovies, totalSeries,
      totalRevenue, activeSubscriptions, totalPayments,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.channel.count({ where: { isActive: true } }),
      this.prisma.movie.count({ where: { isActive: true } }),
      this.prisma.series.count({ where: { isActive: true } }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'completed' } }),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.payment.count({ where: { status: 'completed' } }),
    ]);
    return {
      totalUsers, activeUsers,
      totalChannels, totalMovies, totalSeries,
      totalRevenue: totalRevenue._sum.amount ?? 0,
      activeSubscriptions, totalPayments,
    };
  }

  async getUserGrowth(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const users = await this.prisma.user.findMany({
      where: { createdAt: { gte: start }, deletedAt: null },
      select: { createdAt: true },
    });
    const byDay: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      byDay[d.toISOString().slice(0, 10)] = 0;
    }
    for (const u of users) {
      const key = u.createdAt.toISOString().slice(0, 10);
      if (key in byDay) byDay[key]++;
    }
    return Object.entries(byDay).map(([date, count]) => ({ date, count }));
  }

  async getRevenueByPeriod(days = 30) {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const payments = await this.prisma.payment.findMany({
      where: { createdAt: { gte: start }, status: 'completed' },
      select: { createdAt: true, amount: true, currency: true },
    });
    const byDay: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      byDay[d.toISOString().slice(0, 10)] = 0;
    }
    for (const p of payments) {
      const key = p.createdAt.toISOString().slice(0, 10);
      if (key in byDay) byDay[key] += Number(p.amount);
    }
    return Object.entries(byDay).map(([date, revenue]) => ({ date, revenue }));
  }

  async getSubscriptionBreakdown() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      include: { _count: { select: { subscriptions: { where: { status: 'active' } } } } },
      where: { isActive: true },
    });
    const total = plans.reduce((s, p) => s + p._count.subscriptions, 0);
    return plans.map(p => ({
      planName: p.name,
      count: p._count.subscriptions,
      percentage: total > 0 ? Math.round((p._count.subscriptions / total) * 100) : 0,
      monthlyRevenue: Number(p.price) * p._count.subscriptions,
    }));
  }

  async getContentPerformance() {
    const [topChannels, topMovies, topSeries] = await Promise.all([
      this.prisma.channel.findMany({
        where: { isActive: true },
        select: { id: true, name: true, viewCount: true, category: { select: { name: true } } },
        orderBy: { viewCount: 'desc' },
        take: 10,
      }),
      this.prisma.movie.findMany({
        where: { isActive: true },
        select: { id: true, title: true, viewCount: true, rating: true },
        orderBy: { viewCount: 'desc' },
        take: 10,
      }),
      this.prisma.series.findMany({
        where: { isActive: true },
        select: { id: true, title: true, viewCount: true },
        orderBy: { viewCount: 'desc' },
        take: 10,
      }),
    ]);
    return { topChannels, topMovies, topSeries };
  }

  async getWatchStats() {
    const [totalWatched, completedWatched] = await Promise.all([
      this.prisma.watchHistory.count(),
      this.prisma.watchHistory.count({ where: { completed: true } }),
    ]);
    const avgPositionAgg = await this.prisma.watchHistory.aggregate({ _avg: { position: true } });
    const avgDurationAgg = await this.prisma.watchHistory.aggregate({ _avg: { duration: true } });
    const avgPos = avgPositionAgg._avg.position ?? 0;
    const avgDur = avgDurationAgg._avg.duration ?? 0;
    const avgProgress = avgDur > 0 ? Math.round((avgPos / avgDur) * 100) : 0;
    return {
      totalWatched,
      completedWatched,
      completionRate: totalWatched > 0 ? Math.round((completedWatched / totalWatched) * 100) : 0,
      avgProgress,
    };
  }
}
