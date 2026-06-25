import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async findByContent(contentType: string, contentId: string, query: PaginationDto) {
    const { skip, limit = 20, page = 1 } = query;

    const where: any = {
      contentType,
      contentId,
      isApproved: true,
    };

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { data, meta: paginate(total, page, limit) };
  }

  async getStats(contentType: string, contentId: string) {
    const where = { contentType, contentId, isApproved: true };

    const [aggResult, groupResult] = await Promise.all([
      this.prisma.review.aggregate({
        where,
        _avg: { rating: true },
        _count: true,
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where,
        _count: { rating: true },
      }),
    ]);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const group of groupResult) {
      if (group.rating >= 1 && group.rating <= 5) {
        distribution[group.rating] = group._count.rating;
      }
    }

    return {
      averageRating: aggResult._avg.rating ? Math.round(aggResult._avg.rating * 100) / 100 : 0,
      totalReviews: aggResult._count,
      distribution,
    };
  }

  async upsert(userId: string, dto: CreateReviewDto) {
    const existing = await this.prisma.review.findFirst({
      where: {
        userId,
        contentType: dto.contentType,
        contentId: dto.contentId,
      },
    });

    if (existing) {
      return this.prisma.review.update({
        where: { id: existing.id },
        data: {
          rating: dto.rating,
          title: dto.title,
          comment: dto.comment,
          isApproved: false,
        },
      });
    }

    return this.prisma.review.create({
      data: {
        userId,
        contentType: dto.contentType,
        contentId: dto.contentId,
        rating: dto.rating,
        title: dto.title,
        comment: dto.comment,
      },
    });
  }

  async removeForUser(userId: string, id: string) {
    const review = await this.prisma.review.findFirst({
      where: { id, userId },
    });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.review.delete({ where: { id } });
    return { message: 'Review deleted' };
  }

  async findAllAdmin(query: PaginationDto & { isApproved?: string; contentType?: string; search?: string }) {
    const where: any = {};

    if (query.isApproved !== undefined && query.isApproved !== '') {
      where.isApproved = query.isApproved === 'true';
    }

    if (query.contentType) {
      where.contentType = query.contentType;
    }

    if (query.search) {
      where.comment = { contains: query.search, mode: 'insensitive' };
    }

    const { skip, limit = 20, page = 1 } = query;

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return { data, meta: paginate(total, page, limit) };
  }

  async moderate(id: string, dto: ModerateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    if (dto.isApproved !== undefined) {
      return this.prisma.review.update({
        where: { id },
        data: { isApproved: dto.isApproved },
      });
    }

    return review;
  }

  async removeAdmin(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');

    await this.prisma.review.delete({ where: { id } });
    return { message: 'Review deleted' };
  }
}