import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GitHubSourcesService } from './github-sources.service';
import { CreateGitHubSourceDto, UpdateGitHubSourceDto } from './dto/create-github-source.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('GitHub Sources')
@ApiBearerAuth()
@Controller({ path: 'github-sources', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class GitHubSourcesController {
  constructor(private readonly service: GitHubSourcesService) {}

  @Get()
  @ApiOperation({ summary: 'List all GitHub sources' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a GitHub source by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a new GitHub source' })
  create(@Body() dto: CreateGitHubSourceDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a GitHub source' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGitHubSourceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a GitHub source' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger an immediate sync for this source' })
  syncNow(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.syncNow(id, false);
  }

  @Post(':id/force-sync')
  @ApiOperation({ summary: 'Force a full re-fetch and reprocess (clears ETag cache)' })
  forceSyncNow(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.syncNow(id, true);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get sync logs for a GitHub source' })
  getLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getLogs(id, limit ? parseInt(limit) : 50);
  }
}
