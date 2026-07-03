import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdvertisementsService } from './advertisements.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { VERSION_NEUTRAL } from '@nestjs/common';

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
}
