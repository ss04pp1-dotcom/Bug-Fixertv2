import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnnouncementsService, CreateAnnouncementDto } from './announcements.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'announcements', version: '1' })
export class AnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @Public() @Get('active') @ApiOperation({ summary: 'Get active announcements' })
  getActive() { return this.announcementsService.getActive(); }

  @Get() @ApiBearerAuth() @Roles('super_admin', 'admin', 'moderator') @ApiOperation({ summary: 'Get all announcements' })
  findAll(@Query() query: PaginationDto) { return this.announcementsService.findAll(query); }

  @Get(':id') @ApiBearerAuth() @Roles('super_admin', 'admin', 'moderator') @ApiOperation({ summary: 'Get announcement' })
  findOne(@Param('id') id: string) { return this.announcementsService.findOne(id); }

  @Post() @ApiBearerAuth() @Roles('super_admin', 'admin', 'moderator') @ApiOperation({ summary: 'Create announcement' })
  create(@Body() dto: CreateAnnouncementDto) { return this.announcementsService.create(dto); }

  @Put(':id') @ApiBearerAuth() @Roles('super_admin', 'admin', 'moderator') @ApiOperation({ summary: 'Update announcement' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateAnnouncementDto>) { return this.announcementsService.update(id, dto); }

  @Delete(':id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete announcement' })
  remove(@Param('id') id: string) { return this.announcementsService.remove(id); }
}
