import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SeriesService } from './series.service';
import { GeoBlockService } from '../geo-block/geo-block.service';
import { CreateSeriesDto, CreateSeasonDto, CreateEpisodeDto } from './dto/create-series.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Series')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'series', version: '1' })
export class SeriesController {
  constructor(
    private seriesService: SeriesService,
    private geoBlockService: GeoBlockService,
  ) {}

  private async enforceGeoBlock(req: Request): Promise<void> {
    const country = (req.headers['cf-ipcountry'] ?? req.headers['x-country']) as string | undefined;
    if (!country) return;
    const { isBlocked } = await this.geoBlockService.isBlocked(country);
    if (isBlocked) throw new ForbiddenException(`Content is not available in your region (${country})`);
  }

  @Public() @Get() @ApiOperation({ summary: 'Get all series' })
  async findAll(@Query() query: PaginationDto & { genre?: string; categoryId?: string; isActive?: 'true' | 'false' | 'all' }, @Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.seriesService.findAll(query as any);
  }

  @Public() @Get('featured') @ApiOperation({ summary: 'Get featured series' })
  async getFeatured(@Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.seriesService.getFeatured();
  }

  @Public() @Get(':id') @ApiOperation({ summary: 'Get series with seasons and episodes' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.seriesService.findOne(id);
  }

  @Public() @Get(':id/related') @ApiOperation({ summary: 'Get related series by genre/category' })
  async findRelated(@Param('id') id: string, @Req() req: Request, @Query('limit') limit?: string) {
    await this.enforceGeoBlock(req);
    return this.seriesService.findRelated(id, limit ? parseInt(limit, 10) : 10);
  }

  @Public() @Get(':id/recommendations') @ApiOperation({ summary: 'Get series recommendations (alias for /related)' })
  async getRecommendations(@Param('id') id: string, @Req() req: Request, @Query('limit') limit?: string) {
    await this.enforceGeoBlock(req);
    return this.seriesService.findRelated(id, limit ? parseInt(limit, 10) : 10);
  }

  @Post() @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Create series' })
  create(@Body() dto: CreateSeriesDto) { return this.seriesService.create(dto); }

  @Put(':id') @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Update series' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateSeriesDto>) { return this.seriesService.update(id, dto); }

  @Delete(':id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete series' })
  remove(@Param('id') id: string) { return this.seriesService.remove(id); }

  @Post(':id/seasons') @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Add season' })
  createSeason(@Param('id') id: string, @Body() dto: CreateSeasonDto) { return this.seriesService.createSeason(id, dto); }

  @Put('seasons/:seasonId') @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Update season' })
  updateSeason(@Param('seasonId') sid: string, @Body() dto: Partial<CreateSeasonDto>) { return this.seriesService.updateSeason(sid, dto); }

  @Delete('seasons/:seasonId') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete season' })
  deleteSeason(@Param('seasonId') sid: string) { return this.seriesService.deleteSeason(sid); }

  @Post('seasons/:seasonId/episodes') @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Add episode' })
  createEpisode(@Param('seasonId') sid: string, @Body() dto: CreateEpisodeDto) { return this.seriesService.createEpisode(sid, dto); }

  @Put('episodes/:episodeId') @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Update episode' })
  updateEpisode(@Param('episodeId') eid: string, @Body() dto: Partial<CreateEpisodeDto>) { return this.seriesService.updateEpisode(eid, dto); }

  @Delete('episodes/:episodeId') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete episode' })
  deleteEpisode(@Param('episodeId') eid: string) { return this.seriesService.deleteEpisode(eid); }
}
