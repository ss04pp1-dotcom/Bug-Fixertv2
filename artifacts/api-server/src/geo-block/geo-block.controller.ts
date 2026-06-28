import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GeoBlockService } from './geo-block.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Geo Blocking')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'geo-block', version: '1' })
export class GeoBlockController {
  constructor(private geoBlockService: GeoBlockService) {}

  @Get() @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get all geo restrictions' })
  getAll() { return this.geoBlockService.getAll(); }

  @Public() @Get('check/auto') @ApiOperation({ summary: 'Check geo-block using request IP headers (CF-IPCountry or X-Country)' })
  checkAuto(@Req() req: Request) {
    // A-045: do NOT default missing country headers to 'US' — that whitelists every
    // anonymous request that doesn't carry a country header (VPN/proxy users, direct
    // connections, internal probes). Default to 'UNKNOWN' and have the service treat
    // it as blocked (deny-by-default).
    const country = ((req.headers['cf-ipcountry'] ?? req.headers['x-country']) as string | undefined)?.toUpperCase() || 'UNKNOWN';
    return this.geoBlockService.isBlocked(country);
  }

  @Public() @Get('check/:country') @ApiOperation({ summary: 'Check if country is blocked' })
  check(@Param('country') country: string) { return this.geoBlockService.isBlocked(country.toUpperCase()); }

  @Post() @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Set geo restriction' })
  set(@Body() body: { countryCode: string; isBlocked: boolean; reason?: string }) {
    return this.geoBlockService.set(body.countryCode.toUpperCase(), body.isBlocked, body.reason);
  }

  @Delete(':country') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Remove geo restriction' })
  remove(@Param('country') country: string) { return this.geoBlockService.remove(country.toUpperCase()); }
}
