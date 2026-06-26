import { Injectable, NotFoundException, BadRequestException, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { Prisma, PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreatePaymentDto, RefundDto, WebhookDto, CreateGatewayDto } from './dto/payments.dto';
import { Request } from 'express';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto & { status?: string; search?: string }) {
    const where: Prisma.PaymentWhereInput = {};
    if (query.status && query.status !== 'all' && (Object.values(PaymentStatus) as string[]).includes(query.status)) {
      where.status = query.status as PaymentStatus;
    }
    if (query.search) {
      where.OR = [
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { gateway:       { contains: query.search, mode: 'insensitive' } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where, skip: query.skip, take: query.limit || 20,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: { include: { plan: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async findByUser(userId: string, query: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId }, skip: query.skip, take: query.limit || 20,
        orderBy: { createdAt: 'desc' },
        include: { subscription: { include: { plan: true } } },
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async create(dto: CreatePaymentDto) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    const invoiceNumber = `INV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    return this.prisma.payment.create({
      data: { ...dto, invoiceNumber } as Prisma.PaymentCreateInput,
    });
  }

  async verify(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');

    return this.prisma.$transaction(async (tx) => {
      // Re-read inside transaction to prevent race condition where two simultaneous
      // verify calls both see status !== 'completed' before either commits
      const current = await tx.payment.findUnique({ where: { id } });
      if (!current || current.status === 'completed') {
        throw new BadRequestException('Payment already verified');
      }
      const updated = await tx.payment.update({
        where: { id },
        data: { status: 'completed', paidAt: new Date() },
      });

      if (payment.subscriptionId) {
        const sub = await tx.subscription.findUnique({
          where: { id: payment.subscriptionId }, include: { plan: true },
        });
        if (sub) {
          const endsAt = new Date();
          endsAt.setDate(endsAt.getDate() + sub.plan.durationDays);
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: 'active', endsAt, nextRenewalAt: endsAt },
          });
          await tx.user.update({
            where: { id: payment.userId },
            data: { isPremium: true, subscriptionEndsAt: endsAt },
          });
        }
      }
      return updated;
    });
  }

  async refund(id: string, dto: RefundDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'refunded') throw new BadRequestException('Payment already refunded');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: { status: 'refunded', refundedAt: new Date(), refundReason: dto.reason },
      });

      if (payment.subscriptionId) {
        await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: { status: 'refunded' },
        });
        await tx.user.update({
          where: { id: payment.userId },
          data: { isPremium: false },
        });
      }

      if (payment.subscriptionId) {
        const sub = await tx.subscription.findUnique({ where: { id: payment.subscriptionId } });
        if (sub?.couponCode) {
          await tx.coupon.update({
            where: { code: sub.couponCode },
            data: { usedCount: { decrement: 1 } },
          });
        }
      }
      return updated;
    });
  }

  async getInvoice(id: string, requestingUserId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId !== requestingUserId) throw new ForbiddenException('Access denied');

    return {
      invoiceNumber: payment.invoiceNumber,
      issuedAt: payment.createdAt,
      paidAt: payment.paidAt,
      status: payment.status,
      customer: payment.user,
      plan: payment.subscription?.plan?.name || 'N/A',
      amount: payment.amount,
      currency: payment.currency,
      gateway: payment.gateway,
      gatewayTxId: payment.gatewayTxId,
    };
  }

  async handleWebhook(payload: WebhookDto, signature: string, req: Request) {
    const gatewaySlug = payload.gateway ?? (req.headers?.['x-gateway'] as string | undefined) ?? 'unknown';

    const gateway = await this.prisma.paymentGateway.findFirst({
      where: { slug: gatewaySlug, isActive: true },
    }).catch(() => null);

    if (!gateway?.webhookSecret) {
      this.logger.error(`Webhook rejected: no secret configured for gateway ${gatewaySlug}`);
      throw new BadRequestException('Webhook secret not configured for this gateway');
    }
    const rawBody = (req as any).rawBody as string | undefined;
    if (!rawBody) {
      this.logger.error('Webhook rejected: raw body not captured');
      throw new BadRequestException('Raw body not available for signature verification');
    }
    const expected = 'sha256=' + crypto
      .createHmac('sha256', gateway.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const received = (signature ?? '').padEnd(expected.length, '\0').slice(0, expected.length);
    const expectedBuf = Buffer.from(expected);
    const receivedBuf = Buffer.from(received);
    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (payload.transactionId) {
      const existing = await this.prisma.payment.findFirst({ where: { gatewayTxId: payload.transactionId } });
      if (existing) {
        await this.prisma.payment.update({
          where: { id: existing.id },
          data: {
            webhookPayload: payload as Prisma.InputJsonValue,
            status: payload.status === 'success' ? 'completed' : payload.status === 'failed' ? 'failed' : 'pending',
            paidAt: payload.status === 'success' ? new Date() : undefined,
          },
        }).catch((e: Error) => {
          this.logger.error(`Webhook DB update failed for txId ${payload.transactionId}: ${e.message}`, e.stack);
        });

        if (payload.status === 'success' && existing.subscriptionId) {
          const sub = await this.prisma.subscription.findUnique({
            where: { id: existing.subscriptionId },
            include: { plan: true },
          });
          if (sub) {
            const endsAt = new Date();
            endsAt.setDate(endsAt.getDate() + sub.plan.durationDays);
            await this.prisma.subscription.update({
              where: { id: sub.id },
              data: { status: 'active', endsAt, nextRenewalAt: endsAt },
            });
            await this.prisma.user.update({
              where: { id: existing.userId },
              data: { isPremium: true, subscriptionEndsAt: endsAt },
            });
            await this.prisma.subscriptionHistory.create({
              data: {
                userId: existing.userId,
                subscriptionId: sub.id,
                planId: sub.planId,
                fromStatus: sub.status,
                toStatus: 'active',
                reason: 'webhook_payment_completed',
              },
            });
          }
        }
      }
    }

    return { received: true, gateway: gatewaySlug, event: payload.event };
  }

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, monthly, daily, completed, failed, refunded, byGateway] = await Promise.all([
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'completed' } }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'completed', createdAt: { gte: startOfMonth } } }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'completed', createdAt: { gte: startOfDay } } }),
      this.prisma.payment.count({ where: { status: 'completed' } }),
      this.prisma.payment.count({ where: { status: 'failed' } }),
      this.prisma.payment.count({ where: { status: 'refunded' } }),
      this.prisma.payment.groupBy({ by: ['gateway'], _sum: { amount: true }, _count: { _all: true }, where: { status: 'completed' } }),
    ]);

    return {
      totalRevenue: total._sum.amount || 0,
      monthlyRevenue: monthly._sum.amount || 0,
      dailyRevenue: daily._sum.amount || 0,
      totalTransactions: completed,
      failedTransactions: failed,
      refundedTransactions: refunded,
      byGateway,
    };
  }

  async getGateways() {
    return this.prisma.paymentGateway.findMany({ orderBy: { name: 'asc' } });
  }

  async createGateway(dto: CreateGatewayDto) {
    return this.prisma.paymentGateway.create({ data: dto as Prisma.PaymentGatewayCreateInput });
  }

  async updateGateway(id: string, dto: Partial<CreateGatewayDto>) {
    const gw = await this.prisma.paymentGateway.findUnique({ where: { id } });
    if (!gw) throw new NotFoundException('Gateway not found');
    return this.prisma.paymentGateway.update({ where: { id }, data: dto as Prisma.PaymentGatewayUpdateInput });
  }

  async upsertBySlug(slug: string, dto: Partial<CreateGatewayDto>) {
    return this.prisma.paymentGateway.upsert({
      where: { slug },
      create: { name: dto.name ?? slug, slug, ...dto } as Prisma.PaymentGatewayCreateInput,
      update: dto as Prisma.PaymentGatewayUpdateInput,
    });
  }

  async deleteGateway(id: string) {
    const gw = await this.prisma.paymentGateway.findUnique({ where: { id } });
    if (!gw) throw new NotFoundException('Gateway not found');
    await this.prisma.paymentGateway.delete({ where: { id } });
    return { message: 'Gateway deleted' };
  }
}
