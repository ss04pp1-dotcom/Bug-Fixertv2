import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PlaybackEventsService } from './playback-events.service';
import { ReportPlaybackDto } from './dto/report-playback.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Playback Events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'playback-events', version: '1' })
export class PlaybackEventsController {
  constructor(private readonly service: PlaybackEventsService) {}

  @Post('report')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Report a playback event (requires auth)' })
  report(@Body() dto: ReportPlaybackDto, @CurrentUser('id') userId: string) {
    return this.service.report({ ...dto, userId });
  }

  @Get('stats/:channelId')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Get playback stats for a channel (last 24h / 100 events)' })
  getStats(@Param('channelId') channelId: string) {
    return this.service.getChannelStats(channelId);
  }
}
