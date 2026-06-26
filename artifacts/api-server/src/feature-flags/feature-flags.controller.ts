import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('Feature Flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'feature-flags', version: '1' })
export class FeatureFlagsController {
  constructor(private featureFlagsService: FeatureFlagsService) {}

  @Public() @Get('enabled') @ApiOperation({ summary: 'Get all enabled feature flags' })
  getEnabled() { return this.featureFlagsService.getEnabled(); }

  @Public() @Get(':name') @ApiOperation({ summary: 'Check a specific flag' })
  get(@Param('name') name: string) { return this.featureFlagsService.get(name); }

  @Get() @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get all flags (paginated)' })
  getAll(@Query() query: PaginationDto) { return this.featureFlagsService.getAll(query); }

  @Post() @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Set feature flag' })
  set(@Body() body: { name: string; isEnabled: boolean; description?: string; roles?: string[] }) {
    return this.featureFlagsService.set(body.name, body.isEnabled, body.description, body.roles);
  }

  @Post(':name/toggle') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Toggle flag' })
  toggle(@Param('name') name: string) { return this.featureFlagsService.toggle(name); }

  @Delete(':name') @ApiBearerAuth() @Roles('super_admin') @ApiOperation({ summary: 'Delete flag' })
  delete(@Param('name') name: string) { return this.featureFlagsService.delete(name); }
}
