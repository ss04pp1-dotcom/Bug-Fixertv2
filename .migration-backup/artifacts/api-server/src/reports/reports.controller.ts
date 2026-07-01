import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('super_admin', 'admin')
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform overview report' })
  getOverview() {
    return this.reportsService.getOverview();
  }

  @Get('user-growth')
  @ApiOperation({ summary: 'User growth over time' })
  @ApiQuery({ name: 'days', required: false })
  getUserGrowth(@Query('days') days?: string) {
    return this.reportsService.getUserGrowth(Number(days) || 30);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue by period' })
  @ApiQuery({ name: 'days', required: false })
  getRevenue(@Query('days') days?: string) {
    return this.reportsService.getRevenueByPeriod(Number(days) || 30);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Subscription breakdown by plan' })
  getSubscriptions() {
    return this.reportsService.getSubscriptionBreakdown();
  }

  @Get('content')
  @ApiOperation({ summary: 'Content performance report' })
  getContent() {
    return this.reportsService.getContentPerformance();
  }

  @Get('watch-stats')
  @ApiOperation({ summary: 'Watch statistics' })
  getWatchStats() {
    return this.reportsService.getWatchStats();
  }
}
