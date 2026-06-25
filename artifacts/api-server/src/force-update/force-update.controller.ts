import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ForceUpdateService, ForceUpdateConfig } from './force-update.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Force Update')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'force-update', version: '1' })
export class ForceUpdateController {
  constructor(private forceUpdateService: ForceUpdateService) {}

  @Public()
  @Get('check')
  @ApiOperation({ summary: 'Check if an update is required for a given version' })
  @ApiQuery({ name: 'version', required: true })
  @ApiQuery({ name: 'platform', required: true, enum: ['android', 'ios'] })
  check(
    @Query('version') version: string,
    @Query('platform') platform: 'android' | 'ios',
  ) {
    return this.forceUpdateService.check(version || '1.0.0', platform || 'android');
  }

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Get force update configuration (public)' })
  getConfig() {
    return this.forceUpdateService.getConfig();
  }

  @Post('config')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Update force update configuration' })
  setConfig(@Body() body: Partial<ForceUpdateConfig>) {
    return this.forceUpdateService.setConfig(body);
  }
}
