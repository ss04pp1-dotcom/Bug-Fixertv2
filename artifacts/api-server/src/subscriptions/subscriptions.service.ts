import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import {
  CreatePlanDto, CreateSubscriptionDto, VerifySubscriptionDto,
  CreateCouponDto, ApplyCouponDto,
} from './dto/create-plan.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  constructor(private prisma: PrismaService) {}

  async getPlans(query: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({
        skip: query.skip, take: query.limit || 20,
        orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
        include: { _count: { select: { subscriptions: true } } },
      }),
      this.prisma.subscriptionPlan.count(),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async getPlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async createPlan(dto: CreatePlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');
    return this.prisma.subscriptionPlan.create({ data: dto });
  }

  async updatePlan(id: string, dto: Partial<CreatePlanDto>) {
    await this.getPlan(id);
    return this.prisma.subscriptionPlan.update({ where: { id }, data: dto });
  }

  async deletePlan(id: string) {
    await this.getPlan(id);
    const activeSubs = await this.prisma.subscription.count({ where: { planId: id, status: 'active' } });
    if (activeSubs > 0) throw new BadRequestException('Cannot delete plan with active subscriptions');
    await this.prisma.subscriptionPlan.delete({ where: { id } });
    return { message: 'Plan deleted' };
  }

  async subscribe(dto: CreateSubscriptionDto & { userId: string }) {
    const plan = await this.getPlan(dto.planId);

    let discount = 0;
    let couponCode: string | undefined;

    let couponId: string | undefined;

    const now = new Date();
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + plan.durationDays);

    const trialEndsAt = plan.trialDays > 0 ? new Date(Date.now() + plan.trialDays * 86400000) : undefined;
    const status = plan.trialDays > 0 ? 'trial' : 'active';
    // NOTE: finalAmount is computed inside the transaction (finalAmountTx) after the coupon
    // has been validated with FOR UPDATE locking — see the transaction body below.
    const invoiceNumber = `INV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // Move coupon validation INSIDE the transaction so we read the current usedCount
      // with row-level locking semantics (SELECT ... FOR UPDATE) and immediately increment it
      // in the same transaction — this closes the race window where two concurrent
      // `subscribe()` calls both pass the `usedCount < maxUses` check before either commits.
      if (dto.couponCode) {
        // SELECT FOR UPDATE — Postgres locks the row so concurrent transactions block
        // until this one commits. Prisma doesn't expose FOR UPDATE directly, so use $queryRaw.
        const [locked] = await tx.$queryRaw<{ id: string; is_active: boolean; expires_at: Date | null; max_uses: number | null; used_count: number; per_user_limit: number; discount_type: string; discount_value: number; min_purchase: number | null; plan_ids: string[] }[]>`
          SELECT id, is_active, expires_at, max_uses, used_count, per_user_limit,
                 discount_type, discount_value, min_purchase, plan_ids
          FROM coupons
          WHERE code = ${dto.couponCode}
          FOR UPDATE
        `;
        if (!locked) throw new NotFoundException('Coupon not found');
        if (!locked.is_active) throw new BadRequestException('Coupon is inactive');
        if (locked.expires_at && locked.expires_at < new Date()) throw new BadRequestException('Coupon has expired');
        if (locked.max_uses && locked.used_count >= locked.max_uses) throw new BadRequestException('Coupon usage limit reached');

        if (dto.userId && locked.per_user_limit > 0) {
          const usageCount = await tx.couponUsage.count({
            where: { couponId: locked.id, userId: dto.userId },
          });
          if (usageCount >= locked.per_user_limit) throw new BadRequestException('Per-user coupon limit reached');
        }

        if (locked.plan_ids && locked.plan_ids.length > 0 && !locked.plan_ids.includes(plan.id)) {
          throw new BadRequestException('Coupon not valid for this plan');
        }
        if (locked.min_purchase && plan.price < locked.min_purchase) {
          throw new BadRequestException(`Minimum purchase of ${locked.min_purchase} required`);
        }

        discount = locked.discount_type === 'percentage'
          ? (plan.price * locked.discount_value) / 100
          : locked.discount_value;
        discount = Math.min(discount, plan.price);
        couponCode = dto.couponCode;
        couponId = locked.id;
      }

      // Recompute finalAmount now that discount is final.
      const finalAmountTx = Math.max(0, plan.price - discount);

      const existing = await tx.subscription.findUnique({ where: { userId: dto.userId } });

      // Always use the real UUID from the fetched plan (dto.planId may be a slug)
      const subData: Prisma.SubscriptionUpdateInput = {
        plan: { connect: { id: plan.id } },
        status: status as SubscriptionStatus,
        endsAt, trialEndsAt,
        renewedAt: now, nextRenewalAt: endsAt,
        couponCode, discount,
        autoRenew: dto.autoRenew ?? true,
      };

      let sub;
      if (existing) {
        const prevStatus = existing.status;
        sub = await tx.subscription.update({ where: { userId: dto.userId }, data: subData });
        await tx.subscriptionHistory.create({
          data: { userId: dto.userId, subscriptionId: sub.id, planId: plan.id, fromStatus: prevStatus, toStatus: status as SubscriptionStatus },
        });
      } else {
        sub = await tx.subscription.create({ data: { userId: dto.userId, ...subData } as Prisma.SubscriptionCreateInput });
        await tx.subscriptionHistory.create({
          data: { userId: dto.userId, subscriptionId: sub.id, planId: plan.id, toStatus: status as SubscriptionStatus },
        });
      }

      if (couponId) {
        await Promise.all([
          tx.couponUsage.create({ data: { couponId, userId: dto.userId, discount } }),
          tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } }),
        ]);
      }

      const payment = await tx.payment.create({
        data: {
          userId: dto.userId,
          subscriptionId: sub.id,
          gateway: dto.gateway || 'pending',
          amount: finalAmountTx,
          currency: plan.currency || 'USD',
          status: 'pending',
          invoiceNumber,
          metadata: { planName: plan.name, discount, couponCode },
        },
      });

      return { subscription: sub, payment, invoiceNumber };
    });

    return result;
  }

  async verifyAndActivate(dto: VerifySubscriptionDto, userId?: string, isAdmin = false) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
      include: { subscription: { include: { plan: true } } },
    });
    // Admin callers (isAdmin=true) may verify any payment — they're operating from
    // the admin-only `POST /subscriptions/verify` route guarded by @Roles('super_admin','admin').
    // Regular users may only verify their own payments (used by the legacy self-verify flow).
    if (!payment || (userId && !isAdmin && payment.userId !== userId)) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === 'completed') throw new ConflictException('Payment already verified');

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { id: dto.paymentId },
        data: {
          status: 'completed',
          paidAt: new Date(),
          gatewayTxId: dto.gatewayTxId,
          metadata: { ...(payment.metadata as Record<string, unknown> | null ?? {}), ...(dto.metadata ?? {}) } as Prisma.InputJsonValue,
        },
      });

      if (payment.subscription) {
        const plan = payment.subscription.plan;
        const now = new Date();
        const currentEndsAt = payment.subscription.endsAt;
        const baseDate = (payment.subscription.status === 'active' && currentEndsAt && currentEndsAt > now)
          ? currentEndsAt
          : now;
        const endsAt = new Date(baseDate);
        endsAt.setDate(endsAt.getDate() + plan.durationDays);

        await tx.subscription.update({
          where: { id: payment.subscriptionId! },
          data: { status: 'active', endsAt, nextRenewalAt: endsAt },
        });

        await tx.user.update({
          where: { id: payment.userId },
          data: { isPremium: true, subscriptionEndsAt: endsAt },
        });

        await tx.subscriptionHistory.create({
          data: {
            userId: payment.userId,
            subscriptionId: payment.subscriptionId!,
            planId: plan.id,
            fromStatus: payment.subscription.status,
            toStatus: 'active',
            reason: 'payment_verified',
          },
        });
      }

      return { payment: updatedPayment, message: 'Subscription activated' };
    });

    return result;
  }

  async getUserSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('No subscription found');

    // Auto-expire if the subscription end date has passed
    const now = new Date();
    if (
      sub.status === 'active' &&
      sub.endsAt <= now &&
      (!sub.gracePeriodDays || sub.endsAt.getTime() + sub.gracePeriodDays * 86400000 < now.getTime())
    ) {
      const expired = await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'expired' },
        include: { plan: true },
      });
      await Promise.all([
        this.prisma.user.update({
          where: { id: userId },
          data: { isPremium: false, subscriptionEndsAt: null },
        }),
        this.prisma.subscriptionHistory.create({
          data: {
            userId,
            subscriptionId: sub.id,
            planId: sub.planId,
            fromStatus: 'active',
            toStatus: 'expired',
            reason: 'auto_expired',
          },
        }).catch(() => null),
      ]);
      return expired;
    }

    return sub;
  }

  async cancelSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('No subscription found');
    const updated = await this.prisma.subscription.update({
      where: { userId },
      data: { status: 'cancelled', cancelledAt: new Date(), autoRenew: false },
    });
    await this.prisma.subscriptionHistory.create({
      data: { userId, subscriptionId: sub.id, planId: sub.planId, fromStatus: sub.status, toStatus: 'cancelled', reason: 'user_cancelled' },
    });
    if (!sub.endsAt || sub.endsAt <= new Date()) {
      await this.prisma.user.update({ where: { id: userId }, data: { isPremium: false } });
    }
    return updated;
  }

  async toggleAutoRenew(userId: string, autoRenew: boolean) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('No subscription found');
    return this.prisma.subscription.update({ where: { userId }, data: { autoRenew } });
  }

  async getAllSubscriptions(query: PaginationDto & { search?: string }) {
    const where: Prisma.SubscriptionWhereInput = {};
    if (query.search) {
      where.user = { OR: [
        { email: { contains: query.search, mode: 'insensitive' } },
        { name:  { contains: query.search, mode: 'insensitive' } },
      ]};
    }
    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where, skip: query.skip, take: query.limit || 20,
        orderBy: { createdAt: 'desc' },
        include: { plan: true, user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async updateSubscriptionStatus(id: string, status: string) {
    if (!(Object.values(SubscriptionStatus) as string[]).includes(status)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${Object.values(SubscriptionStatus).join(', ')}`);
    }
    const sub = await this.prisma.subscription.findUnique({ where: { id }, include: { plan: true } });
    if (!sub) throw new NotFoundException('Subscription not found');
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: status as SubscriptionStatus,
        ...(status === 'cancelled' ? { cancelledAt: new Date(), autoRenew: false } : {}),
      },
      include: { plan: true, user: { select: { id: true, name: true, email: true } } },
    });
    if (status === 'cancelled') {
      await this.prisma.user.update({ where: { id: sub.userId }, data: { isPremium: false } })
        .catch((e: Error) => this.logger.error(`Failed to revoke premium for user ${sub.userId}: ${e.message}`));
      await this.prisma.subscriptionHistory.create({
        data: { userId: sub.userId, subscriptionId: id, planId: sub.planId, fromStatus: sub.status, toStatus: 'cancelled', reason: 'admin_cancelled' },
      }).catch((e: Error) => this.logger.warn(`Failed to write subscription history for sub ${id}: ${e.message}`));
    }
    return updated;
  }

  async getHistory(query: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.subscriptionHistory.findMany({
        skip: query.skip, take: query.limit || 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.subscriptionHistory.count(),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async getCoupons(query: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({
        skip: query.skip, take: query.limit || 20,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { usages: true } } },
      }),
      this.prisma.coupon.count(),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async createCoupon(dto: CreateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Coupon code already exists');
    return this.prisma.coupon.create({ data: dto as Prisma.CouponCreateInput });
  }

  async updateCoupon(id: string, dto: Partial<CreateCouponDto>) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return this.prisma.coupon.update({ where: { id }, data: dto as Prisma.CouponUpdateInput });
  }

  async deleteCoupon(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    await this.prisma.coupon.delete({ where: { id } });
    return { message: 'Coupon deleted' };
  }

  async validateCoupon(dto: ApplyCouponDto): Promise<{ valid: boolean; discountAmount: number; discountType: string; coupon: Prisma.CouponGetPayload<Record<string, never>> }> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: dto.code } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    if (!coupon.isActive) throw new BadRequestException('Coupon is inactive');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new BadRequestException('Coupon has expired');
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw new BadRequestException('Coupon usage limit reached');
    if (dto.userId && coupon.perUserLimit > 0) {
      const usageCount = await this.prisma.couponUsage.count({
        where: { couponId: coupon.id, userId: dto.userId },
      });
      if (usageCount >= coupon.perUserLimit) throw new BadRequestException('Per-user coupon limit reached');
    }

    let discountAmount = 0;
    let plan: Awaited<ReturnType<typeof this.prisma.subscriptionPlan.findFirst>> = null;
    if (dto.planId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      plan = await this.prisma.subscriptionPlan.findFirst({
        where: uuidRegex.test(dto.planId) ? { OR: [{ id: dto.planId }, { slug: dto.planId }] } : { slug: dto.planId },
      });
      if (plan) {
        if (coupon.planIds.length > 0 && !coupon.planIds.includes(plan.id)) {
          throw new BadRequestException('Coupon not valid for this plan');
        }
        if (plan.price < (coupon.minPurchase || 0)) throw new BadRequestException(`Minimum purchase of ${coupon.minPurchase} required`);
        discountAmount = coupon.discountType === 'percentage'
          ? (plan.price * coupon.discountValue) / 100
          : coupon.discountValue;
        discountAmount = Math.min(discountAmount, plan.price);
      }
    }

    return { valid: true, discountAmount, discountType: coupon.discountType, coupon };
  }
}
