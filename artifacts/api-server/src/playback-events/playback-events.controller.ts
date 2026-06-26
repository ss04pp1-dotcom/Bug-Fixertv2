import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PlaybackEventsService } from './playback-events.service';
import { ReportPlaybackDto } from './dto/report-playback.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Playback Events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'playback-events', version: '1' })
export class PlaybackEventsController {
  constructor(private readonly service: PlaybackEventsService) {}

  @Public()
  @Post('report')
  @ApiOperation({ summary: 'Report a playback event (success or failure)' })
  report(@Body() dto: ReportPlaybackDto) {
    return this.service.report(dto);
  }

  @Get('stats/:channelId')
  @ApiBearerAuth()
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Get playback stats for a channel (last 24h / 100 events)' })
  getStats(@Param('channelId') channelId: string) {
    return this.service.getChannelStats(channelId);
  }
}
