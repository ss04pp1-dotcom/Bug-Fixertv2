import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';

@ApiTags('Reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Public() @Get() @ApiOperation({ summary: 'List reviews for a content' })
  findByContent(
    @Query('contentType') contentType: string,
    @Query('contentId') contentId: string,
    @Query() query: PaginationDto,
  ) {
    return this.reviewsService.findByContent(contentType, contentId, query);
  }

  @Public() @Get('stats/:contentType/:contentId') @ApiOperation({ summary: 'Get review stats for a content' })
  getStats(@Param('contentType') contentType: string, @Param('contentId') contentId: string) {
    return this.reviewsService.getStats(contentType, contentId);
  }

  @ApiBearerAuth() @Post() @ApiOperation({ summary: 'Create or update a review' })
  upsert(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviewsService.upsert(userId, dto);
  }

  @ApiBearerAuth() @Roles('super_admin', 'admin', 'moderator') @Get('admin') @ApiOperation({ summary: 'Admin: list all reviews' })
  findAllAdmin(@Query() query: PaginationDto & { isApproved?: string; contentType?: string; search?: string }) {
    return this.reviewsService.findAllAdmin(query);
  }

  @ApiBearerAuth() @Roles('super_admin', 'admin', 'moderator') @Put('admin/:id') @ApiOperation({ summary: 'Admin: moderate a review' })
  moderate(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.reviewsService.moderate(id, dto);
  }

  @ApiBearerAuth() @Roles('super_admin', 'admin') @Delete('admin/:id') @ApiOperation({ summary: 'Admin: hard delete a review' })
  removeAdmin(@Param('id') id: string) {
    return this.reviewsService.removeAdmin(id);
  }

  @ApiBearerAuth() @Delete(':id') @ApiOperation({ summary: 'Delete own review' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.reviewsService.removeForUser(userId, id);
  }
}