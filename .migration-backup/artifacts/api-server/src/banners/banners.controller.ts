import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BannersService, CreateBannerDto } from './banners.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Banners')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'banners', version: '1' })
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Public()
  @Get('active')
  @ApiOperation({ summary: 'Get active banners (public)' })
  getActive() {
    return this.bannersService.findActive();
  }

  @Get()
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'List all banners (admin)' })
  findAll(@Query() query: PaginationDto) {
    return this.bannersService.findAll(query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Get banner by ID' })
  findOne(@Param('id') id: string) {
    return this.bannersService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Create banner' })
  create(@Body() dto: CreateBannerDto) {
    return this.bannersService.create(dto);
  }

  @Put(':id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Update banner' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateBannerDto>) {
    return this.bannersService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete banner' })
  remove(@Param('id') id: string) {
    return this.bannersService.remove(id);
  }
}
