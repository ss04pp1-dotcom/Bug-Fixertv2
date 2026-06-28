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
    // A-041: clamp days so a malicious client can't ask for e.g. 10 years of daily buckets.
    const d = Math.min(Math.max(parseInt(days || '', 10) || 30, 1), 365);
    return this.analyticsService.getUserGrowth(d);
  }

  @Get('revenue') @ApiOperation({ summary: 'Revenue overview' })
  getRevenue(@Query('months') months?: string) {
    // A-041: clamp months (max 24 = 2 years).
    const m = Math.min(Math.max(parseInt(months || '', 10) || 12, 1), 24);
    return this.analyticsService.getRevenueOverview(m);
  }

  @Get('top-channels') @ApiOperation({ summary: 'Top channels by views' })
  getTopChannels(@Query('limit') limit?: string) {
    // A-041: clamp limit (max 100).
    const l = Math.min(Math.max(parseInt(limit || '', 10) || 10, 1), 100);
    return this.analyticsService.getTopChannels(l);
  }

  @Get('top-movies') @ApiOperation({ summary: 'Top movies by views' })
  getTopMovies(@Query('limit') limit?: string) {
    // A-041: clamp limit (max 100).
    const l = Math.min(Math.max(parseInt(limit || '', 10) || 10, 1), 100);
    return this.analyticsService.getTopMovies(l);
  }

  @Get('devices') @ApiOperation({ summary: 'Device breakdown from sessions (last 30 days)' })
  getDevices() {
    return this.analyticsService.getDeviceBreakdown();
  }

  @Get('retention') @ApiOperation({ summary: 'Weekly retention curve (cohort-based)' })
  getRetention(@Query('weeks') weeks?: string) {
    // A-041: clamp weeks (max 52 = 1 year).
    const w = Math.min(Math.max(parseInt(weeks || '', 10) || 12, 1), 52);
    return this.analyticsService.getRetentionCurve(w);
  }
}
