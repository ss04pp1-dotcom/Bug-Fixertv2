import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin')
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard') @ApiOperation({ summary: 'Dashboard overview stats' })
  getDashboard() { return this.analyticsService.getDashboardStats(); }

  @Get('user-growth') @ApiOperation({ summary: 'User growth chart' })
  getUserGrowth(@Query('days') days?: string) {
    return this.analyticsService.getUserGrowth(days ? parseInt(days, 10) : undefined);
  }

  @Get('revenue') @ApiOperation({ summary: 'Revenue overview' })
  getRevenue(@Query('months') months?: string) {
    return this.analyticsService.getRevenueOverview(months ? parseInt(months, 10) : undefined);
  }

  @Get('top-channels') @ApiOperation({ summary: 'Top channels by views' })
  getTopChannels(@Query('limit') limit?: string) {
    return this.analyticsService.getTopChannels(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('top-movies') @ApiOperation({ summary: 'Top movies by views' })
  getTopMovies(@Query('limit') limit?: string) {
    return this.analyticsService.getTopMovies(limit ? parseInt(limit, 10) : undefined);
  }

  @Get('devices') @ApiOperation({ summary: 'Device breakdown from sessions (last 30 days)' })
  getDevices() {
    return this.analyticsService.getDeviceBreakdown();
  }

  @Get('retention') @ApiOperation({ summary: 'Weekly retention curve (cohort-based)' })
  getRetention(@Query('weeks') weeks?: string) {
    return this.analyticsService.getRetentionCurve(weeks ? parseInt(weeks, 10) : undefined);
  }
}
