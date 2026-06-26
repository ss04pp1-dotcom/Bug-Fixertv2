import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService) {}

  private async nextTicketNo(): Promise<string> {
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
    const ticketNo = await this.nextTicketNo();
    return this.prisma.supportTicket.create({
      data: { ticketNo, userEmail: dto.userEmail, subject: dto.subject, description: dto.description, priority: dto.priority ?? 'Medium' },
    });
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
