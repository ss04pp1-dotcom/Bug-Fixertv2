import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { EpgService, CreateEpgDto } from './epg.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('EPG')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'epg', version: '1' })
export class EpgController {
  constructor(private epgService: EpgService) {}

  @Public() @Get('channels/:channelId') @ApiOperation({ summary: 'Get EPG for channel' })
  async getForChannel(@Param('channelId') id: string, @Query('date') date?: string) {
    const data = await this.epgService.getForChannel(id, date);
    return { data };
  }

  @Public() @Get('channels/:channelId/now') @ApiOperation({ summary: 'Current and next program' })
  getCurrentAndNext(@Param('channelId') id: string) {
    return this.epgService.getCurrentAndNext(id);
  }

  @Post() @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Create EPG entry' })
  create(@Body() dto: CreateEpgDto) { return this.epgService.create(dto); }

  @Post('bulk') @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Bulk create EPG' })
  bulkCreate(@Body() body: { programs: CreateEpgDto[] }) { return this.epgService.bulkCreate(body.programs); }

  @Put(':id') @ApiBearerAuth() @Roles('super_admin', 'admin', 'editor') @ApiOperation({ summary: 'Update EPG entry' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateEpgDto>) { return this.epgService.update(id, dto); }

  @Delete(':id') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete EPG entry' })
  remove(@Param('id') id: string) { return this.epgService.remove(id); }

  @Delete('channels/:channelId/clear') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Clear EPG for channel' })
  clearForChannel(@Param('channelId') id: string) { return this.epgService.clearForChannel(id); }
}
