import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WatchHistoryService, UpsertWatchHistoryDto } from './watch-history.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Watch History')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'watch-history', version: '1' })
export class WatchHistoryController {
  constructor(private watchHistoryService: WatchHistoryService) {}

  @Get() @ApiOperation({ summary: 'Get watch history' })
  getHistory(@CurrentUser('id') userId: string, @Query('limit') limit?: number) {
    return this.watchHistoryService.getHistory(userId, limit);
  }

  @Get('continue-watching') @ApiOperation({ summary: 'Continue watching list' })
  getContinueWatching(@CurrentUser('id') userId: string) {
    return this.watchHistoryService.getContinueWatching(userId);
  }

  @Get('recent-channels') @ApiOperation({ summary: 'Recently watched channels' })
  getRecentChannels(@CurrentUser('id') userId: string, @Query('limit') limit?: number) {
    return this.watchHistoryService.getRecentChannels(userId, limit);
  }

  @Post() @ApiOperation({ summary: 'Update watch position' })
  upsert(@CurrentUser('id') userId: string, @Body() dto: UpsertWatchHistoryDto) {
    return this.watchHistoryService.upsert(userId, dto);
  }

  @Delete(':id') @ApiOperation({ summary: 'Remove history item' })
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.watchHistoryService.remove(userId, id);
  }

  @Delete() @ApiOperation({ summary: 'Clear all history' })
  clearAll(@CurrentUser('id') userId: string) {
    return this.watchHistoryService.clearAll(userId);
  }
}
