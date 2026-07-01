import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdvertisementsService } from './advertisements.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateAdDto, CreateAdProviderDto, UpdateAdProviderDto,
  CreateAdPlacementDto, AdEventDto, UpdateAdSettingDto,
} from './dto/advertisements.dto';

@ApiTags('Advertisements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'advertisements', version: '1' })
export class AdvertisementsController {
  constructor(private svc: AdvertisementsService) {}

  @Public() @Get('active') @ApiOperation({ summary: 'Get active ads' })
  getActive(@Query('country') country?: string) { return this.svc.getActive(country); }

  @Get() @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get all ads' })
  findAll(@Query() query: PaginationDto) { return this.svc.findAll(query); }

  @Post() @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Create ad' })
  create(@Body() dto: CreateAdDto) { return this.svc.create(dto); }

  @Put(':id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Update ad' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateAdDto>) { return this.svc.update(id, dto); }

  @Delete(':id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete ad' })
  remove(@Param('id') id: string) { return this.svc.remove(id); }

  @Public() @Post(':id/impression') @Throttle({ default: { limit: 30, ttl: 60000 } }) @ApiOperation({ summary: 'Track impression (legacy)' })
  trackImpression(@Param('id') id: string) { return this.svc.trackImpression(id); }

  @Public() @Post(':id/click') @Throttle({ default: { limit: 20, ttl: 60000 } }) @ApiOperation({ summary: 'Track click (legacy)' })
  trackClick(@Param('id') id: string) { return this.svc.trackClick(id); }

  @Public() @Post('event') @Throttle({ default: { limit: 60, ttl: 60000 } }) @ApiOperation({ summary: 'Track ad event — impression, click, revenue, error, skip, close' })
  trackEvent(@Body() dto: AdEventDto, @Req() req: Request) {
    const eventType = dto.eventType ?? 'impression';
    return this.svc.trackEvent(eventType, dto, req as unknown as { headers?: Record<string, string | string[] | undefined> });
  }

  @Get('providers') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get ad providers' })
  getProviders() { return this.svc.getProviders(); }

  @Post('providers/seed') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Seed all default ad providers' })
  seedProviders() { return this.svc.seedDefaultProviders(); }

  @Post('providers') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Create ad provider' })
  createProvider(@Body() dto: CreateAdProviderDto) { return this.svc.createProvider(dto); }

  @Put('providers/:id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Update ad provider' })
  updateProvider(@Param('id') id: string, @Body() dto: UpdateAdProviderDto) { return this.svc.updateProvider(id, dto); }

  @Delete('providers/:id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete ad provider' })
  deleteProvider(@Param('id') id: string) { return this.svc.deleteProvider(id); }

  @Post('providers/:id/activate') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Set active ad provider' })
  activateProvider(@Param('id') id: string) { return this.svc.activateProvider(id); }

  @Public() @Get('placements/public') @ApiOperation({ summary: 'Get active placements by slug (mobile ad fetching)' })
  getPublicPlacements(@Query('slug') slug?: string) { return this.svc.getPublicPlacements(slug); }

  @Get('placements') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get all placements' })
  getPlacements() { return this.svc.getPlacements(); }

  @Post('placements') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Create placement' })
  createPlacement(@Body() dto: CreateAdPlacementDto) { return this.svc.createPlacement(dto); }

  @Put('placements/:id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Update placement' })
  updatePlacement(@Param('id') id: string, @Body() dto: Partial<CreateAdPlacementDto>) { return this.svc.updatePlacement(id, dto); }

  @Delete('placements/:id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete placement' })
  deletePlacement(@Param('id') id: string) { return this.svc.deletePlacement(id); }

  @Get('settings') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get ad settings' })
  getSettings() { return this.svc.getSettings(); }

  @Put('settings') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Update ad settings' })
  updateSettings(@Body() dto: UpdateAdSettingDto) { return this.svc.updateSettings(dto); }

  @Get('analytics') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Ad analytics' })
  getAnalytics(@Query('from') from?: string, @Query('to') to?: string) {
    return this.svc.getAnalytics(from, to);
  }

  @Post('analytics/seed-demo') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Seed demo analytics data (30 days)' })
  seedDemoAnalytics() { return this.svc.seedDemoAnalytics(); }

  @Delete('analytics/reset') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Reset all analytics data' })
  resetAnalytics() { return this.svc.resetAnalytics(); }
}
