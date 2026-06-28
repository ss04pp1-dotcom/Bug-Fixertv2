import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
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

  @Public()
  @Post('impression')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Track ad impression event' })
  trackImpression(@Body() dto: AdEventDto, @Req() req: Request) {
    return this.svc.trackEvent('impression', dto, req);
  }

  @Public()
  @Post('click')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Track ad click event' })
  trackClick(@Body() dto: AdEventDto, @Req() req: Request) {
    return this.svc.trackEvent('click', dto, req);
  }

  @Public()
  @Post('error')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Track ad error event' })
  trackError(@Body() dto: AdEventDto, @Req() req: Request) {
    return this.svc.trackEvent('error', dto, req);
  }

  @Public()
  @Post('session')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Track ad session event' })
  trackSession(@Body() dto: AdEventDto, @Req() req: Request) {
    return this.svc.trackEvent('session', dto, req);
  }

  @Public()
  @Post('revenue')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Track ad revenue event' })
  trackRevenue(@Body() dto: AdEventDto, @Req() req: Request) {
    return this.svc.trackEvent('revenue', dto, req);
  }
}
