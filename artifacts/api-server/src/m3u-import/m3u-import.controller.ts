import {
  Controller, Get, Post, Delete, Param, Query, Body,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { M3uImportService } from './m3u-import.service';
import { UploadM3uDto } from './dto/upload-m3u.dto';
import { RecheckChannelsDto } from './dto/recheck-channels.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('M3U Import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'm3u-import', version: '1' })
export class M3uImportController {
  constructor(private importService: M3uImportService) {}

  @Post('upload')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Upload M3U file for background processing' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadM3uDto,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.importService.uploadM3u(file, dto.batchSize, dto.saveFailed);
  }

  @Get('jobs')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Get all import jobs' })
  getJobs() {
    return this.importService.getImportJobs();
  }

  @Get('jobs/:id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Get import job detail with all channels' })
  getJob(@Param('id') id: string) {
    return this.importService.getImportJob(id);
  }

  @Get('jobs/:id/progress')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Get import job real-time progress' })
  getProgress(@Param('id') id: string) {
    return this.importService.getImportJobProgress(id);
  }

  @Get('jobs/:id/failed')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Get failed channels for an import job' })
  getFailedChannels(@Param('id') id: string) {
    return this.importService.getImportJobFailedChannels(id);
  }

  @Post('jobs/:id/cancel')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Cancel a running import job' })
  cancelJob(@Param('id') id: string) {
    return this.importService.cancelImportJob(id);
  }

  @Delete('jobs/:id')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Delete an import job' })
  deleteJob(@Param('id') id: string) {
    return this.importService.deleteImportJob(id);
  }

  @Post('health-check/recheck-all')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Recheck all or offline-only channels' })
  recheckAll(@Body() dto: RecheckChannelsDto) {
    return this.importService.triggerHealthCheck(undefined, dto.offlineOnly);
  }

  @Post('health-check/recheck/:channelId')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Recheck a single channel' })
  recheckSingle(@Param('channelId') channelId: string) {
    return this.importService.recheckSingleChannel(channelId);
  }

  @Get('health-check/stats')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor', 'moderator')
  @ApiOperation({ summary: 'Get channel health dashboard stats' })
  getHealthStats() {
    return this.importService.getChannelHealthStats();
  }

  @Get('health-check/failed-channels')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Get all failed/offline channels' })
  getFailedChannelsList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.importService.getFailedChannels({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
    });
  }

  @Get('import-history')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor', 'moderator')
  @ApiOperation({ summary: 'Get import history for dashboard' })
  getImportHistory() {
    return this.importService.getImportHistory();
  }

  @Get('deleted-channels')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'editor')
  @ApiOperation({ summary: 'Get auto-deleted channel log' })
  getDeletedChannelLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.importService.getDeletedChannelLogs({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Delete('deleted-channels')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Clear all deleted channel logs' })
  clearDeletedChannelLogs() {
    return this.importService.clearDeletedChannelLogs();
  }

  @Post('cleanup/run')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin')
  @ApiOperation({ summary: 'Manually trigger cleanup of 7-day inactive channels' })
  runCleanup() {
    return this.importService.cleanupInactiveChannels();
  }
}