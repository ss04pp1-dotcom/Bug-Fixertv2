import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Res, Req, HttpStatus, ForbiddenException } from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ChannelsService } from './channels.service';
import { GeoBlockService } from '../geo-block/geo-block.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { BulkImportChannelsDto, ParsePlaylistDto } from './dto/bulk-import-channel.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SettingsService } from '../settings/settings.service';
import { HealthOverride } from '@prisma/client';

@ApiTags('Channels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'channels', version: '1' })
export class ChannelsController {
  constructor(
    private channelsService: ChannelsService,
    private geoBlockService: GeoBlockService,
    private settingsService: SettingsService,
  ) {}

  private async enforceGeoBlock(req: Request): Promise<void> {
    const country = (req.headers['cf-ipcountry'] ?? req.headers['x-country']) as string | undefined;
    if (!country) return;
    const { isBlocked } = await this.geoBlockService.isBlocked(country);
    if (isBlocked) throw new ForbiddenException(`Content is not available in your region (${country})`);
  }

  private async getHealthMode(): Promise<string> {
    try {
      const s = await this.settingsService.get('health_check_mode');
      return (s?.value as string) || 'SERVER';
    } catch { return 'SERVER'; }
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all channels' })
  async findAll(@Query() query: PaginationDto, @Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.channelsService.findAll(query);
  }

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Get featured channels' })
  getFeatured() { return this.channelsService.getFeatured(); }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Get trending channels' })
  getTrending() { return this.channelsService.getTrending(); }

  @Get('export')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Export channels as JSON, CSV, or M3U' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv', 'm3u'] })
  async exportChannels(@Query('format') format: 'json' | 'csv' | 'm3u' = 'json', @Res() res: Response) {
    const content = await this.channelsService.exportChannels(format);
    const mimeMap = { json: 'application/json', csv: 'text/csv', m3u: 'application/x-mpegurl' };
    const extMap  = { json: 'json', csv: 'csv', m3u: 'm3u' };
    res.setHeader('Content-Type', mimeMap[format]);
    res.setHeader('Content-Disposition', `attachment; filename="channels.${extMap[format]}"`);
    return res.status(HttpStatus.OK).send(content);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Create a channel' })
  create(@Body() dto: CreateChannelDto) { return this.channelsService.create(dto); }

  @Post('bulk')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Bulk import channels' })
  bulkImport(@Body() dto: BulkImportChannelsDto) { return this.channelsService.bulkImport(dto); }

  @Post('bulk-import')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Bulk import channels (alias for /bulk)' })
  bulkImportAlias(@Body() dto: BulkImportChannelsDto) { return this.channelsService.bulkImport(dto); }

  @Post('merge-duplicates')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Merge duplicate channels by normalized name' })
  mergeDuplicates() { return this.channelsService.mergeDuplicates(); }

  @Post('cleanup-bad-names')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Soft-delete channels with image-URL-style names from broken M3U parsing' })
  cleanupBadNames() { return this.channelsService.cleanupBadChannelNames(); }

  @Post('parse-playlist')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Fetch and parse a remote M3U/JSON/CSV playlist URL' })
  parsePlaylist(@Body() dto: ParsePlaylistDto) { return this.channelsService.parsePlaylistUrl(dto.url); }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get channel by ID or slug' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.channelsService.findOne(id);
  }

  @Public()
  @Get(':id/stream')
  @ApiOperation({ summary: 'Get stream URL for a channel' })
  async getStream(@Param('id') id: string, @Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.channelsService.getStreamUrl(id);
  }

  @Public()
  @Post(':id/view')
  @ApiOperation({ summary: 'Increment view count' })
  incrementView(@Param('id') id: string) { return this.channelsService.incrementViewCount(id); }

  @Get(':id/health')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Get full health stats for a channel' })
  async getHealth(@Param('id') id: string) {
    const mode = await this.getHealthMode();
    return this.channelsService.getChannelHealthStats(id, mode);
  }

  @Put(':id/health-override')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Set manual health override for a channel' })
  setOverride(@Param('id') id: string, @Body('override') override: HealthOverride) {
    return this.channelsService.setHealthOverride(id, override);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Update a channel' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateChannelDto>) {
    return this.channelsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete a channel' })
  remove(@Param('id') id: string) { return this.channelsService.remove(id); }

  // ── Admin overrides ─────────────────────────────────────────────────────────

  @Patch(':id/overrides')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Set admin overrides for a GitHub-synced channel' })
  updateOverrides(@Param('id') id: string, @Body() dto: any) {
    return this.channelsService.updateOverrides(id, dto);
  }

  @Delete(':id/overrides/:field')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Reset a specific admin override back to GitHub value' })
  resetOverride(@Param('id') id: string, @Param('field') field: string) {
    return this.channelsService.resetOverride(id, field);
  }

  // ── Server management ────────────────────────────────────────────────────────

  @Get(':id/servers')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor', 'moderator')
  @ApiOperation({ summary: 'Get all servers for a channel (admin — includes disabled)' })
  getServers(@Param('id') id: string) {
    return this.channelsService.getServers(id);
  }

  @Post(':id/servers')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Add an admin-managed server to a channel' })
  addServer(@Param('id') id: string, @Body() dto: any) {
    return this.channelsService.addServer(id, dto);
  }

  @Put(':id/servers')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Bulk-reorder servers (set priorities)' })
  reorderServers(@Param('id') id: string, @Body() body: { servers: { id: string; priority: number }[] }) {
    return this.channelsService.reorderServers(id, body.servers);
  }

  @Patch(':id/servers/:serverId')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Update a single server (enabled, link, headers)' })
  updateServer(
    @Param('id') id: string,
    @Param('serverId') serverId: string,
    @Body() dto: any,
  ) {
    return this.channelsService.updateServer(id, serverId, dto);
  }

  @Post(':id/servers/:serverId/test')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor', 'moderator')
  @ApiOperation({ summary: 'Test server reachability from the API host' })
  testServer(@Param('id') id: string, @Param('serverId') serverId: string) {
    return this.channelsService.testServer(id, serverId);
  }

  @Delete(':id/servers/:serverId')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Soft-delete a server from a channel' })
  deleteServer(@Param('id') id: string, @Param('serverId') serverId: string) {
    return this.channelsService.deleteServer(id, serverId);
  }
}
