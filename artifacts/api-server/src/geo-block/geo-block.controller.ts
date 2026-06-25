import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
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

  @Public() @Get('check/:country') @ApiOperation({ summary: 'Check if country is blocked' })
  check(@Param('country') country: string) { return this.geoBlockService.isBlocked(country.toUpperCase()); }

  @Post() @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Set geo restriction' })
  set(@Body() body: { countryCode: string; isBlocked: boolean; reason?: string }) {
    return this.geoBlockService.set(body.countryCode.toUpperCase(), body.isBlocked, body.reason);
  }

  @Delete(':country') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Remove geo restriction' })
  remove(@Param('country') country: string) { return this.geoBlockService.remove(country.toUpperCase()); }
}
