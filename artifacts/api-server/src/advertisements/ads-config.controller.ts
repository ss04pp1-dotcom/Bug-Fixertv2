import { Controller, Get, Post, Put, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdvertisementsService } from './advertisements.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { AdEventDto } from './dto/advertisements.dto';
import { VERSION_NEUTRAL } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Ads Config & Events')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'v1/ads', version: VERSION_NEUTRAL })
export class AdsConfigController {
  constructor(private svc: AdvertisementsService) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Get remote ad + app configuration' })
  getConfig() { return this.svc.getRemoteConfig(); }

  @Put('global-config')
  @ApiOperation({ summary: 'Update global ad rule engine config (admin only)' })
  updateGlobalConfig(@Body() body: Record<string, unknown>) {
    return this.svc.updateGlobalAdConfig(body);
  }

  /**
   * Generic event tracker used by the mobile app's `trackAdEvent()` helper
   * (VAST pre-roll + smartlink impression/click tracking): POST /ads/:type
   * where :type is impression | click | error | session | revenue.
   */
  @Public()
  @Post(':type')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Track ad event by type (impression, click, error, session, revenue)' })
  trackByType(@Param('type') type: string, @Body() dto: AdEventDto, @Req() req: Request) {
    return this.svc.trackEvent(type, dto, req);
  }
}
