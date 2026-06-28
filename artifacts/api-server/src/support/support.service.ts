import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(private prisma: PrismaService) {}

  private async nextTicketNo(): Promise<string> {
    // A-042: two concurrent `create()` calls could compute the same `count + 1`
    // value and one of them would fail with a P2002 unique-constraint violation
    // on ticketNo. We expose the count+format helper here; the retry loop around
    // the create() call (see `create()`) handles the actual P2002 by re-deriving
    // a fresh ticketNo from the now-bumped count.
    const count = await this.prisma.supportTicket.count();
    return `TKT${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(query: { status?: string; priority?: string; page?: number; limit?: number }) {
    const { status, priority, page = 1, limit = 20 } = query;
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') where.status = status;
    if (priority && priority !== 'all') where.priority = priority;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.supportTicket.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async create(dto: { userEmail: string; subject: string; description?: string; priority?: string }) {
    // A-042: wrap the create in a retry loop that catches P2002 (unique constraint on
    // ticketNo). Two concurrent create() calls can both compute the same `count + 1`
    // value before either INSERT commits; one will fail with P2002 — on retry the
    // count() will reflect the now-committed ticket and produce a fresh number.
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ticketNo = await this.nextTicketNo();
      try {
        return await this.prisma.supportTicket.create({
          data: {
            ticketNo,
            userEmail: dto.userEmail,
            subject: dto.subject,
            description: dto.description,
            priority: dto.priority ?? 'Medium',
          },
        });
      } catch (e: any) {
        lastErr = e;
        if (e?.code === 'P2002' && attempt < 2) {
          this.logger.warn(`create() ticketNo collision (${ticketNo}) on attempt ${attempt + 1} — retrying`);
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  }

  async update(id: string, dto: { status?: string; priority?: string; assignedTo?: string }) {
    await this.findOne(id);
    const resolvedAt = dto.status === 'Resolved' ? new Date() : undefined;
    return this.prisma.supportTicket.update({
      where: { id },
      data: { ...dto, ...(resolvedAt !== undefined && { resolvedAt }) },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.supportTicket.delete({ where: { id } });
    return { message: 'Ticket deleted' };
  }

  async getStats() {
    const [open, pending, resolved, total] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: 'Open' } }),
      this.prisma.supportTicket.count({ where: { status: 'Pending' } }),
      this.prisma.supportTicket.count({ where: { status: 'Resolved' } }),
      this.prisma.supportTicket.count(),
    ]);
    return { open, pending, resolved, total };
  }
}
