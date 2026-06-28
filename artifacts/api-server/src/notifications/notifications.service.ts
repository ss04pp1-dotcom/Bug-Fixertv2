import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, NotificationType } from '@prisma/client';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsEnum, IsDateString, IsUrl } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';

export class CreateNotificationDto {
  @IsString() @IsNotEmpty() title: string;
  @IsString() @IsNotEmpty() body: string;
  @IsOptional() @IsEnum(NotificationType) type?: NotificationType;
  @IsOptional() @IsBoolean() targetAll?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) targetRoles?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) targetUsers?: string[];
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsBoolean() isPremium?: boolean;
  @IsOptional() @IsUrl() imageUrl?: string;
  @IsOptional() @IsString() deepLink?: string;
  @IsOptional() @IsDateString() scheduledAt?: Date;
}

interface FcmApp {
  messaging: () => {
    sendEachForMulticast: (msg: {
      tokens: string[];
      notification: { title: string; body: string };
      data?: Record<string, string>;
    }) => Promise<{ successCount: number; failureCount: number }>;
    send: (msg: {
      token: string;
      notification: { title: string; body: string };
    }) => Promise<string>;
  };
}

let fcmApp: FcmApp | null = null;
let fcmInitAttempted = false;

async function initFcm(
  logger: Logger,
  overrides?: { projectId: string; clientEmail: string; privateKey: string },
): Promise<FcmApp | null> {
  // If explicit overrides provided (from DB settings), always re-init
  if (overrides) {
    fcmInitAttempted = false;
    fcmApp = null;
  }
  if (fcmInitAttempted) return fcmApp;
  fcmInitAttempted = true;

  const projectId   = overrides?.projectId   ?? process.env['FIREBASE_PROJECT_ID'];
  const privateKey  = (overrides?.privateKey  ?? process.env['FIREBASE_PRIVATE_KEY'])?.replace(/\\n/g, '\n');
  const clientEmail = overrides?.clientEmail  ?? process.env['FIREBASE_CLIENT_EMAIL'];

  if (!projectId || !privateKey || !clientEmail) {
    logger.warn('FCM not configured (set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY or save in Admin → Settings → Firebase)');
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const admin = await import('firebase-admin');
    if (admin.apps?.length) {
      fcmApp = admin as unknown as FcmApp;
    } else {
      admin.initializeApp({ credential: admin.credential.cert({ projectId, privateKey, clientEmail }) });
      fcmApp = admin as unknown as FcmApp;
    }
    logger.log('Firebase Admin SDK initialized');
  } catch (err) {
    logger.error('Firebase Admin init failed', err instanceof Error ? err.message : String(err));
    fcmApp = null;
  }
  return fcmApp;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  private async getFcmApp(): Promise<FcmApp | null> {
    // Try DB settings as fallback/override of env vars
    try {
      const rows = await this.prisma.setting.findMany({
        where: { key: { in: ['firebase_project_id', 'firebase_client_email', 'firebase_private_key'] } },
      });
      const cfg: Record<string, string> = {};
      for (const r of rows) cfg[r.key] = String(r.value ?? '');

      if (cfg['firebase_project_id'] && cfg['firebase_client_email'] && cfg['firebase_private_key']) {
        return initFcm(this.logger, {
          projectId: cfg['firebase_project_id'],
          clientEmail: cfg['firebase_client_email'],
          privateKey: cfg['firebase_private_key'],
        });
      }
    } catch (err) {
      this.logger.warn('Could not read Firebase settings from DB', err instanceof Error ? err.message : String(err));
    }
    return initFcm(this.logger);
  }

  async findAll(query: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({ skip: query.skip, take: query.limit || 20, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count(),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async findOne(id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Notification not found');
    return n;
  }

  async create(dto: CreateNotificationDto) {
    const data: Prisma.NotificationCreateInput = {
      title: dto.title, body: dto.body,
      ...(dto.type        !== undefined && { type: dto.type }),
      ...(dto.targetAll   !== undefined && { targetAll: dto.targetAll }),
      ...(dto.targetRoles !== undefined && { targetRoles: dto.targetRoles }),
      ...(dto.targetUsers !== undefined && { targetUsers: dto.targetUsers }),
      ...(dto.country     !== undefined && { country: dto.country }),
      ...(dto.language    !== undefined && { language: dto.language }),
      ...(dto.isPremium   !== undefined && { isPremium: dto.isPremium }),
      ...(dto.imageUrl    !== undefined && { imageUrl: dto.imageUrl }),
      ...(dto.deepLink    !== undefined && { deepLink: dto.deepLink }),
      ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt }),
    };
    return this.prisma.notification.create({ data });
  }

  async send(id: string) {
    const notification = await this.findOne(id);

    const firebase = await this.getFcmApp();
    if (firebase) {
      try {
        const where: Prisma.UserWhereInput = { fcmToken: { not: null }, isActive: true };
        if (!notification.targetAll) {
          const conditions: Prisma.UserWhereInput[] = [];
          if (notification.targetUsers?.length) conditions.push({ id: { in: notification.targetUsers } });
          if (notification.targetRoles?.length) conditions.push({ role: { in: notification.targetRoles as any[] } });
          if (notification.country) conditions.push({ country: notification.country });
          if (notification.language) conditions.push({ language: notification.language });
          if (notification.isPremium != null) conditions.push({ isPremium: notification.isPremium });
          if (conditions.length) where['OR'] = conditions;
        }

        // Paginate through ALL matching users in batches of 500 so large audiences
        // actually receive the push — the previous `take: 500` silently truncated.
        let skip = 0;
        const batchSize = 500;
        let totalSent = 0;
        let totalFailed = 0;
        while (true) {
          const users = await this.prisma.user.findMany({
            where,
            select: { fcmToken: true },
            take: batchSize,
            skip,
          });
          if (users.length === 0) break;
          const tokens = users.map(u => u.fcmToken!).filter(Boolean);
          if (tokens.length) {
            const result = await firebase.messaging().sendEachForMulticast({
              tokens,
              notification: { title: notification.title, body: notification.body },
            });
            totalSent += result.successCount;
            totalFailed += result.failureCount;
          }
          if (users.length < batchSize) break;
          skip += batchSize;
        }
        this.logger.log(`Push sent: ${totalSent} ok, ${totalFailed} failed`);
      } catch (err) {
        this.logger.error('FCM send error', err instanceof Error ? err.message : String(err));
      }
    }

    // Mark sentAt AFTER all batches complete so the notification isn't reported as
    // "sent" while pushes are still in flight.
    await this.prisma.notification.update({ where: { id }, data: { sentAt: new Date() } });
    return notification;
  }

  async testPush(token: string) {
    const firebase = await this.getFcmApp();
    if (!firebase) throw new BadRequestException('Firebase not configured. Save credentials in Settings → Firebase / FCM first.');
    const msgId = await firebase.messaging().send({
      token,
      notification: { title: '🔔 StreamPro Test Push', body: 'Push notifications are working correctly!' },
    });
    return { message: 'Test push sent', messageId: msgId };
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.notification.delete({ where: { id } });
    return { message: 'Notification deleted' };
  }

  // ─── User-facing endpoints ────────────────────────────────────────────────

  async getUserNotifications(userId: string, query: PaginationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, country: true, language: true, isPremium: true },
    });

    const where: Prisma.NotificationWhereInput = {
      isActive: true,
      OR: [
        { targetAll: true },
        { targetUsers: { has: userId } },
        ...(user?.role ? [{ targetRoles: { has: user.role as string } }] : []),
      ],
      AND: [
        ...(user?.country  ? [{ OR: [{ country: null }, { country: user.country }] }] : [{ country: null }]),
        ...(user?.language ? [{ OR: [{ language: null }, { language: user.language }] }] : [{ language: null }]),
      ],
    };

    const reads = await this.prisma.notificationRead.findMany({
      where: { userId },
      select: { notificationId: true },
    });
    const readIds = new Set(reads.map(r => r.notificationId));

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: query.skip,
        take: query.limit || 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: data.map(n => ({ ...n, isRead: readIds.has(n.id) })),
      meta: paginate(total, query.page || 1, query.limit || 20),
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.findOne(notificationId);
    await this.prisma.notificationRead.upsert({
      where: { userId_notificationId: { userId, notificationId } },
      create: { userId, notificationId },
      update: { readAt: new Date() },
    });
    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, country: true, language: true },
    });

    const where: Prisma.NotificationWhereInput = {
      isActive: true,
      OR: [
        { targetAll: true },
        { targetUsers: { has: userId } },
        ...(user?.role ? [{ targetRoles: { has: user.role as string } }] : []),
      ],
    };

    const notifications = await this.prisma.notification.findMany({
      where,
      select: { id: true },
    });

    // Use createMany with skipDuplicates (single round-trip) instead of unbounded
    // parallel upserts which can saturate the connection pool for users with many
    // notifications.
    const now = new Date();
    await this.prisma.notificationRead.createMany({
      data: notifications.map(n => ({ userId, notificationId: n.id, readAt: now })),
      skipDuplicates: true,
    });

    return { message: `${notifications.length} notifications marked as read` };
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, country: true, language: true },
    });

    const where: Prisma.NotificationWhereInput = {
      isActive: true,
      OR: [
        { targetAll: true },
        { targetUsers: { has: userId } },
        ...(user?.role ? [{ targetRoles: { has: user.role as string } }] : []),
      ],
      readReceipts: { none: { userId } },
    };

    const count = await this.prisma.notification.count({ where });
    return { count };
  }
}
