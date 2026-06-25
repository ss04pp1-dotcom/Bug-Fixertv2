import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Res, Req, HttpStatus, ForbiddenException } from '@nestjs/common';
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

@ApiTags('Channels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'channels', version: '1' })
export class ChannelsController {
  constructor(
    private channelsService: ChannelsService,
    private geoBlockService: GeoBlockService,
  ) {}

  private async enforceGeoBlock(req: Request): Promise<void> {
    const country = (req.headers['cf-ipcountry'] ?? req.headers['x-country']) as string | undefined;
    if (!country) return;
    const { isBlocked } = await this.geoBlockService.isBlocked(country);
    if (isBlocked) throw new ForbiddenException(`Content is not available in your region (${country})`);
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
  getFeatured() {
    return this.channelsService.getFeatured();
  }

  @Public()
  @Get('trending')
  @ApiOperation({ summary: 'Get trending channels' })
  getTrending() {
    return this.channelsService.getTrending();
  }

  @Get('export')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Export channels as JSON, CSV, or M3U' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv', 'm3u'] })
  async exportChannels(@Query('format') format: 'json' | 'csv' | 'm3u' = 'json', @Res() res: Response) {
    const content = await this.channelsService.exportChannels(format);
    const mimeMap = { json: 'application/json', csv: 'text/csv', m3u: 'application/x-mpegurl' };
    const extMap  = { json: 'json', csv: 'csv', m3u: 'm3u' };
    res.setHeader('Content-Type', mimeMap[format] ?? 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="channels.${extMap[format]}"`);
    res.status(HttpStatus.OK).send(content);
  }

  @Post('bulk-import')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Bulk import channels' })
  bulkImport(@Body() dto: BulkImportChannelsDto) {
    return this.channelsService.bulkImport(dto);
  }

  @Post('parse-playlist')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Fetch and return raw playlist content from a URL (server-side proxy to avoid CORS)' })
  parsePlaylist(@Body() dto: ParsePlaylistDto) {
    return this.channelsService.parsePlaylistUrl(dto.url);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get channel by ID or slug' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.channelsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Create channel' })
  create(@Body() dto: CreateChannelDto) {
    return this.channelsService.create(dto);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Update channel' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateChannelDto>) {
    return this.channelsService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete channel' })
  remove(@Param('id') id: string) {
    return this.channelsService.remove(id);
  }
}
