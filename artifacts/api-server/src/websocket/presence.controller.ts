import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PresenceService } from './presence.service';

@ApiTags('Presence')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'presence', version: '1' })
@ApiBearerAuth()
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Get('live')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get all currently online users (WebSocket presence)' })
  getLive() {
    return { data: this.presence.getAll(), total: this.presence.getOnlineCount() };
  }

  @Get('stats')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Get real-time presence stats' })
  getStats() {
    return this.presence.getStats();
  }
}
