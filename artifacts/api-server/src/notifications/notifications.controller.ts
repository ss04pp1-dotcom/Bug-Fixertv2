import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService, CreateNotificationDto } from './notifications.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin', 'moderator')
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications' })
  findAll(@Query() query: PaginationDto) { return this.notificationsService.findAll(query); }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  findOne(@Param('id') id: string) { return this.notificationsService.findOne(id); }

  @Post()
  @ApiOperation({ summary: 'Create notification' })
  create(@Body() dto: CreateNotificationDto) { return this.notificationsService.create(dto); }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send notification via FCM' })
  send(@Param('id') id: string) { return this.notificationsService.send(id); }

  @Post('test-push')
  @ApiOperation({ summary: 'Send a test push notification to a device token' })
  testPush(@Body() body: { token: string }) { return this.notificationsService.testPush(body.token); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  remove(@Param('id') id: string) { return this.notificationsService.remove(id); }
}
