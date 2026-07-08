import { Injectable, NotFoundException, BadRequestException, ForbiddenException, UnauthorizedException, Logger, Optional, Inject } from '@nestjs/common';
import { Prisma, PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreatePaymentDto, RefundDto, WebhookDto, CreateGatewayDto } from './dto/payments.dto';
import { Request } from 'express';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(AuditService) private auditService?: AuditService,
  ) {}

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
    // Verify the subscription belongs to the caller — prevents a client from creating
    // a payment against someone else's subscription and then claiming it as their own.
    if (dto.subscriptionId) {
      const sub = await this.prisma.subscription.findUnique({ where: { id: dto.subscriptionId } });
      if (!sub || sub.userId !== dto.userId) {
        throw new ForbiddenException('Subscription does not belong to the requesting user');
      }
      // Use the plan's price as the authoritative amount — ignore the client-supplied
      // `amount` to prevent users from paying $0.01 for a $9.99 plan and then demanding activation.
      const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } });
      if (plan) {
        dto = { ...dto, amount: plan.price, currency: plan.currency || dto.currency };
      }
    }
    const invoiceNumber = `INV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    // Client-created payments are ALWAYS `pending` — they can only be flipped to `completed`
    // by an admin (verify) or a signed webhook. Never trust the client's status field.
    return this.prisma.payment.create({
      data: { ...dto, invoiceNumber, status: 'pending' } as Prisma.PaymentCreateInput,
    });
  }

  async verify(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');

    return this.prisma.$transaction(async (tx) => {
      // Re-read inside transaction to prevent race condition where two simultaneous
      // verify calls both see status !== 'completed' before either commits.
      // Only `pending` payments can be verified — blocks re-verifying refunded/failed/completed.
      const current = await tx.payment.findUnique({ where: { id } });
      if (!current || current.status !== 'pending') {
        throw new BadRequestException('Only pending payments can be verified');
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
      // A-061: audit the manual verify — admin-side payment verifications are
      // financially meaningful (they grant premium access) and should be traceable.
      if (this.auditService) {
        this.auditService.log({
          action: 'payment.verify',
          resource: 'payment',
          resourceId: id,
          newValues: { status: 'completed', userId: payment.userId, amount: payment.amount } as unknown as Prisma.InputJsonValue,
          level: 'info',
        }).catch(() => undefined);
      }
      return updated;
    });
  }

  async refund(id: string, dto: RefundDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'refunded') throw new BadRequestException('Payment already refunded');
    // Only completed payments can be refunded — blocks refunding pending/failed payments
    // (which would otherwise let an admin mark a never-paid payment as refunded and trigger
    // the coupon decrement side-effect on a payment that never activated the subscription).
    if (payment.status !== 'completed') throw new BadRequestException('Only completed payments can be refunded');

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
      // A-061: audit refunds — they reverse revenue and revoke premium access.
      if (this.auditService) {
        this.auditService.log({
          action: 'payment.refund',
          resource: 'payment',
          resourceId: id,
          newValues: { status: 'refunded', reason: dto.reason, userId: payment.userId, amount: payment.amount } as unknown as Prisma.InputJsonValue,
          level: 'warning',
        }).catch(() => undefined);
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
    });

    if (!gateway?.webhookSecret) {
      this.logger.error(`Webhook rejected: no secret configured for gateway ${gatewaySlug}`);
      throw new BadRequestException('Webhook secret not configured for this gateway');
    }
    const rawBody = (req as any).rawBody as string | undefined;
    if (!rawBody) {
      this.logger.error('Webhook rejected: raw body not captured');
      throw new BadRequestException('Raw body not available for signature verification');
    }

    // Per-gateway signature verification — each gateway has its own signing scheme.
    // Stripe uses `t=timestamp,v1=hex` HMAC; SSLCommerz/PayPal/bKash have different formats.
    // See verifyStripeSignature / verifySslcommerzSignature / verifyPaypalSignature below.
    await this.verifyGatewaySignature(gatewaySlug, rawBody, signature ?? '', gateway.webhookSecret);

    if (payload.transactionId) {
      // Idempotency check: if the payment is already 'completed' the webhook is a replay
      // (the gateway retries on 5xx) — skip re-processing so we don't double-extend the
      // subscription or write duplicate history rows. We still return 200 OK so the gateway
      // stops retrying.
      //
      // Wrap the entire status update + subscription activation + user update + history create
      // in a single transaction so a crash mid-flow can't leave the subscription active while
      // the payment row is still pending (or vice versa). On failure, the exception propagates
      // to the controller which returns 500 — the gateway will retry the webhook.
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.payment.findFirst({ where: { gatewayTxId: payload.transactionId } });
        if (!existing) return; // Nothing to update — not a payment we know about.

        if (existing.status === 'completed') {
          // Already processed — idempotent no-op.
          this.logger.log(`Webhook idempotency: payment ${existing.id} already completed, skipping.`);
          return;
        }

        const newStatus: PaymentStatus =
          payload.status === 'success' ? 'completed'
          : payload.status === 'failed' ? 'failed'
          : 'pending';

        await tx.payment.update({
          where: { id: existing.id },
          data: {
            webhookPayload: payload as Prisma.InputJsonValue,
            status: newStatus,
            paidAt: newStatus === 'completed' ? new Date() : undefined,
          },
        });

        if (newStatus === 'completed' && existing.subscriptionId) {
          const sub = await tx.subscription.findUnique({
            where: { id: existing.subscriptionId },
            include: { plan: true },
          });
          if (sub) {
            const endsAt = new Date();
            endsAt.setDate(endsAt.getDate() + sub.plan.durationDays);
            await tx.subscription.update({
              where: { id: sub.id },
              data: { status: 'active', endsAt, nextRenewalAt: endsAt },
            });
            await tx.user.update({
              where: { id: existing.userId },
              data: { isPremium: true, subscriptionEndsAt: endsAt },
            });
            await tx.subscriptionHistory.create({
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
      });
    }

    return { received: true, gateway: gatewaySlug, event: payload.event };
  }

  /**
   * Dispatch signature verification to the correct per-gateway verifier.
   * Throws UnauthorizedException when the signature is invalid or NotImplemented
   * for gateways that haven't been wired up yet.
   */
  private async verifyGatewaySignature(gatewaySlug: string, rawBody: string, signature: string, secret: string): Promise<void> {
    switch (gatewaySlug) {
      case 'stripe':
        if (!this.verifyStripeSignature(rawBody, signature, secret)) {
          throw new UnauthorizedException('Invalid webhook signature');
        }
        return;
      case 'sslcommerz':
        if (!this.verifySslcommerzSignature(rawBody, signature, secret)) {
          throw new UnauthorizedException('Invalid webhook signature');
        }
        return;
      case 'paypal':
        if (!(await this.verifyPaypalSignature(rawBody, signature, secret))) {
          throw new UnauthorizedException('Invalid webhook signature');
        }
        return;
      default: {
        // Legacy / generic gateways: keep the original `sha256=<hex>` HMAC scheme
        // so existing integrations (bKash, manual gateways, etc.) keep working.
        const expected = 'sha256=' + crypto
          .createHmac('sha256', secret)
          .update(rawBody)
          .digest('hex');
        const received = signature.padEnd(expected.length, '\0').slice(0, expected.length);
        const expectedBuf = Buffer.from(expected);
        const receivedBuf = Buffer.from(received);
        if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
          throw new UnauthorizedException('Invalid webhook signature');
        }
      }
    }
  }

  /**
   * Stripe webhook signature verification.
   * Stripe sends `Stripe-Signature: t=<timestamp>,v1=<hex>` and computes the
   * signature as HMAC-SHA256(`<timestamp>.<rawBody>`, webhook_secret).
   * https://docs.stripe.com/webhooks#verify-events
   */
  private verifyStripeSignature(rawBody: string, signature: string, secret: string): boolean {
    try {
      const parts = signature.split(',').map(s => s.trim());
      const tPart = parts.find(p => p.startsWith('t='));
      const v1Part = parts.find(p => p.startsWith('v1='));
      if (!tPart || !v1Part) return false;
      const timestamp = tPart.slice(2);
      const provided = v1Part.slice(3);
      const signedPayload = `${timestamp}.${rawBody}`;
      const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
      // Optional: reject signatures older than 5 minutes to prevent replay.
      const ageSec = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
      if (isNaN(ageSec) || ageSec > 300) return false;
      const a = Buffer.from(expected);
      const b = Buffer.from(provided);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * SSLCommerz IPN validation.
   * SSLCommerz posts form-encoded fields to your IPN URL and includes a
   * `verify_sign` (MD5 of alphabetically-sorted key=value pairs + store_passwd MD5)
   * plus `verify_key` (comma-separated list of keys used). We parse the raw body
   * (application/x-www-form-urlencoded), rebuild the string per SSLCommerz's
   * documented algorithm, and compare in constant time.
   * https://developer.sslcommerz.com/doc/v4/#ipn-validation
   */
  private verifySslcommerzSignature(rawBody: string, _signatureHeader: string, storePasswd: string): boolean {
    try {
      const params = new URLSearchParams(rawBody);
      const verifySign = params.get('verify_sign');
      const verifyKey = params.get('verify_key');
      if (!verifySign || !verifyKey) return false;
      const keys = verifyKey.split(',').filter(Boolean).sort();
      const storePasswdMd5 = crypto.createHash('md5').update(storePasswd).digest('hex');
      const pieces = keys.map(k => `${k}=${params.get(k) ?? ''}`);
      pieces.push(`store_passwd=${storePasswdMd5}`);
      pieces.sort();
      const expected = crypto.createHash('md5').update(pieces.join('&')).digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(verifySign);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * PayPal webhook signature verification.
   * PayPal signs webhooks with a cert-chain scheme. Rather than re-implementing
   * cert-chain crypto ourselves, we call PayPal's `/v1/notifications/verify-webhook-signature`
   * endpoint with the transmission headers and the raw event body. `webhookSecret`
   * MUST be a JSON string containing `{ "clientId": "...", "clientSecret": "...",
   * "webhookId": "...", "env": "live"|"sandbox" }`.
   * https://developer.paypal.com/api/rest/webhooks/rest/#link-verifywebhooksignature
   *
   * NOTE: this method is async internally but the interface stays sync-boolean
   * because verifyGatewaySignature is called from a sync context. We block on
   * a synchronous XHR-equivalent by returning a Promise-like via deasync? No —
   * we widen the signature at the caller instead (see verifyGatewaySignature).
   */
  private async verifyPaypalSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
    try {
      const cfg = JSON.parse(secret) as {
        clientId: string; clientSecret: string; webhookId: string; env?: 'live' | 'sandbox';
      };
      if (!cfg.clientId || !cfg.clientSecret || !cfg.webhookId) return false;
      // signatureHeader is a JSON-encoded object of the required PayPal headers,
      // set by the webhook controller when it forwards the request here.
      const headers = JSON.parse(signatureHeader) as Record<string, string>;
      const base = cfg.env === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
      const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
      const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      if (!tokenRes.ok) return false;
      const { access_token } = await tokenRes.json() as { access_token: string };
      const verifyRes = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'] ?? headers['PAYPAL-AUTH-ALGO'],
          cert_url: headers['paypal-cert-url'] ?? headers['PAYPAL-CERT-URL'],
          transmission_id: headers['paypal-transmission-id'] ?? headers['PAYPAL-TRANSMISSION-ID'],
          transmission_sig: headers['paypal-transmission-sig'] ?? headers['PAYPAL-TRANSMISSION-SIG'],
          transmission_time: headers['paypal-transmission-time'] ?? headers['PAYPAL-TRANSMISSION-TIME'],
          webhook_id: cfg.webhookId,
          webhook_event: JSON.parse(rawBody),
        }),
      });
      if (!verifyRes.ok) return false;
      const { verification_status } = await verifyRes.json() as { verification_status: string };
      return verification_status === 'SUCCESS';
    } catch {
      return false;
    }
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
