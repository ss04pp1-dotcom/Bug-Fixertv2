import { Injectable } from '@nestjs/common';
import { SubscriptionStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../websocket/presence.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
  ) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // Live presence count (WebSocket) — synchronous in-memory read
    const activeUsers = this.presence.getOnlineCount();
    const presenceStats = this.presence.getStats();

    const [
      totalUsers, premiumUsers, newUsersToday,
      totalChannels, totalMovies, totalSeries,
      activeSubscriptions, monthlyRevenue,
      totalAnnouncements,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, isPremium: true } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: startOfDay } } }),
      this.prisma.channel.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.movie.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.series.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.active } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.completed, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.announcement.count({ where: { isActive: true } }),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers, premium: premiumUsers, newToday: newUsersToday },
      content: { channels: totalChannels, movies: totalMovies, series: totalSeries },
      subscriptions: { active: activeSubscriptions },
      revenue: { monthly: monthlyRevenue._sum.amount || 0 },
      announcements: { active: totalAnnouncements },
      presence: presenceStats,
    };
  }

  // Single GROUP BY query instead of one query per day (eliminates N+1)
  async getUserGrowth(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT
        TO_CHAR(DATE("created_at"), 'YYYY-MM-DD') AS date,
        COUNT(*)::int                             AS count
      FROM users
      WHERE created_at >= ${startDate}
        AND deleted_at IS NULL
      GROUP BY DATE("created_at")
      ORDER BY date ASC
    `;

    // Build a full date-range map so every day appears even with 0 registrations
    const rowMap = new Map<string, number>(
      rows.map(r => [r.date, Number(r.count)]),
    );

    const result: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().split('T')[0];
      result.push({ date: key, count: rowMap.get(key) ?? 0 });
    }
    return result;
  }

  // Single GROUP BY query for revenue (eliminates N+1 over months)
  async getRevenueOverview(months = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - (months - 1));
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<Array<{ month: string; revenue: number }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "created_at"), 'Mon YYYY') AS month,
        COALESCE(SUM("amount"), 0)::float                      AS revenue
      FROM payments
      WHERE status = ${PaymentStatus.completed}
        AND created_at >= ${startDate}
      GROUP BY DATE_TRUNC('month', "created_at")
      ORDER BY DATE_TRUNC('month', "created_at") ASC
    `;
    return rows;
  }

  async getTopChannels(limit = 10) {
    return this.prisma.channel.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: { id: true, name: true, logo: true, viewCount: true, country: true },
    });
  }

  async getTopMovies(limit = 10) {
    return this.prisma.movie.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { viewCount: 'desc' },
      take: limit,
      select: { id: true, title: true, poster: true, viewCount: true, year: true },
    });
  }

  async getDeviceBreakdown() {
    const rows = await this.prisma.$queryRaw<Array<{ device_type: string | null; count: bigint }>>`
      SELECT
        COALESCE(LOWER(device_type), 'unknown') AS device_type,
        COUNT(*)::int AS count
      FROM sessions
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY LOWER(device_type)
      ORDER BY count DESC
    `;

    const total = rows.reduce((s, r) => s + Number(r.count), 0) || 1;
    const COLOR_MAP: Record<string, string> = {
      mobile:  '#7C3AED',
      tv:      '#3B82F6',
      desktop: '#10B981',
      tablet:  '#F59E0B',
      unknown: '#6B7280',
    };

    return rows.map(r => {
      const key = r.device_type ?? 'unknown';
      const label = key === 'tv' ? 'TV App' : key.charAt(0).toUpperCase() + key.slice(1);
      return {
        name:  label,
        value: Math.round((Number(r.count) / total) * 100),
        color: COLOR_MAP[key] ?? '#6B7280',
      };
    });
  }

  async getRetentionCurve(weeks = 8) {
    // Week-0 cohort = users who registered in the last `weeks` weeks
    // Week-N retention = % of those users who had a session in week N after signup
    const cohortStart = new Date();
    cohortStart.setDate(cohortStart.getDate() - weeks * 7);
    const cohortEnd = new Date();
    const maxWeekNum = weeks - 1;

    const rows = await this.prisma.$queryRaw<Array<{ week_num: number; retained: bigint; cohort_size: bigint }>>`
      WITH cohort AS (
        SELECT id, created_at AS signup_at
        FROM users
        WHERE created_at >= ${cohortStart}
          AND deleted_at IS NULL
      ),
      cohort_size AS (
        SELECT COUNT(*)::int AS total FROM cohort
      ),
      activity AS (
        SELECT
          c.id,
          FLOOR(EXTRACT(EPOCH FROM (s.created_at - c.signup_at)) / 604800)::int AS week_num
        FROM cohort c
        JOIN sessions s ON s.user_id = c.id
          AND s.created_at >= c.signup_at
          AND s.created_at <= ${cohortEnd}
        GROUP BY c.id, week_num
      )
      SELECT
        a.week_num,
        COUNT(DISTINCT a.id)::int AS retained,
        cs.total                  AS cohort_size
      FROM activity a
      CROSS JOIN cohort_size cs
      WHERE a.week_num BETWEEN 0 AND ${maxWeekNum}
      GROUP BY a.week_num, cs.total
      ORDER BY a.week_num ASC
    `;

    const rowMap = new Map(rows.map(r => [r.week_num, Number(r.retained)]));
    const cohortSize = rows[0] ? Number(rows[0].cohort_size) : 1;

    return Array.from({ length: weeks }, (_, i) => ({
      week:  `W${i + 1}`,
      rate:  cohortSize > 0
        ? Math.round(((rowMap.get(i) ?? 0) / cohortSize) * 100)
        : 0,
    }));
  }
}
