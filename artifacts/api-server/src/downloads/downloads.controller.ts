import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DownloadsService } from './downloads.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateDownloadDto } from './dto/create-download.dto';
import { UpdateDownloadDto } from './dto/update-download.dto';

@ApiTags('Downloads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'downloads', version: '1' })
export class DownloadsController {
  constructor(private downloadsService: DownloadsService) {}

  @Get('admin') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Admin: list all downloads' })
  findAllAdmin(@Query() query: PaginationDto & { contentType?: string }) {
    return this.downloadsService.findAllAdmin(query);
  }

  @Get('admin/stats') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Admin: download stats' })
  getAdminStats() {
    return this.downloadsService.getAdminStats();
  }

  @Get('stats') @ApiOperation({ summary: 'Get download stats' })
  getStats(@CurrentUser('id') userId: string) {
    return this.downloadsService.getStats(userId);
  }

  @Get() @ApiOperation({ summary: 'Get user downloads' })
  findAll(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationDto & { contentType?: string; status?: string },
  ) {
    return this.downloadsService.findAll(userId, query);
  }

  @Post() @ApiOperation({ summary: 'Create a new download request' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateDownloadDto) {
    return this.downloadsService.create(userId, dto);
  }

  @Post(':id/pause') @ApiOperation({ summary: 'Pause a download' })
  pause(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.downloadsService.pause(userId, id);
  }

  @Post(':id/resume') @ApiOperation({ summary: 'Resume a download' })
  resume(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.downloadsService.resume(userId, id);
  }

  @Delete('clear-completed') @ApiOperation({ summary: 'Clear all completed downloads' })
  clearCompleted(@CurrentUser('id') userId: string) {
    return this.downloadsService.clearCompleted(userId);
  }

  @Put(':id') @ApiOperation({ summary: 'Update download progress/status' })
  update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDownloadDto,
  ) {
    return this.downloadsService.update(userId, id, dto);
  }

  @Delete(':id') @ApiOperation({ summary: 'Delete a download' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.downloadsService.remove(userId, id);
  }
}
