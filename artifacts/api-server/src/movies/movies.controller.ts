import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MoviesService } from './movies.service';
import { GeoBlockService } from '../geo-block/geo-block.service';
import { CreateMovieDto } from './dto/create-movie.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Movies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'movies', version: '1' })
export class MoviesController {
  constructor(
    private moviesService: MoviesService,
    private geoBlockService: GeoBlockService,
  ) {}

  private async enforceGeoBlock(req: Request): Promise<void> {
    const country = (req.headers['cf-ipcountry'] ?? req.headers['x-country']) as string | undefined;
    if (!country) return;
    const { isBlocked } = await this.geoBlockService.isBlocked(country);
    if (isBlocked) throw new ForbiddenException(`Content is not available in your region (${country})`);
  }

  @Public() @Get() @ApiOperation({ summary: 'Get all movies' })
  async findAll(@Query() query: PaginationDto, @Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.moviesService.findAll(query);
  }

  @Public() @Get('featured') @ApiOperation({ summary: 'Get featured movies' })
  async getFeatured(@Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.moviesService.getFeatured();
  }

  @Public() @Get('trending') @ApiOperation({ summary: 'Get trending movies' })
  async getTrending(@Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.moviesService.getTrending();
  }

  @Public() @Get(':id') @ApiOperation({ summary: 'Get movie by ID or slug' })
  async findOne(@Param('id') id: string, @Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.moviesService.findOne(id);
  }

  @Public() @Get(':id/related') @ApiOperation({ summary: 'Get related movies by genre/category' })
  async findRelated(@Param('id') id: string, @Req() req: Request, @Query('limit') limit?: string) {
    await this.enforceGeoBlock(req);
    return this.moviesService.findRelated(id, limit ? parseInt(limit, 10) : 10);
  }

  @Get(':id/stream') @ApiBearerAuth() @ApiOperation({ summary: 'Get stream URL for a movie' })
  async getStreamUrl(@Param('id') id: string, @Req() req: Request) {
    await this.enforceGeoBlock(req);
    return this.moviesService.getStreamUrl(id);
  }

  @Post() @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Create movie' })
  create(@Body() dto: CreateMovieDto) { return this.moviesService.create(dto); }

  @Put(':id') @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Update movie' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateMovieDto>) { return this.moviesService.update(id, dto); }

  @Delete(':id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete movie' })
  remove(@Param('id') id: string) { return this.moviesService.remove(id); }
}
