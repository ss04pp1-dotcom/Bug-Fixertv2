import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService, CreateNotificationDto } from './notifications.service';
import { TestPushDto } from './dto/test-push.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  // ─── User-facing endpoints (no admin role required) ───────────────────────

  @Get('user')
  @ApiOperation({ summary: 'Get notifications for the current user' })
  getUserNotifications(@CurrentUser('id') userId: string, @Query() query: PaginationDto) {
    return this.notificationsService.getUserNotifications(userId, query);
  }

  @Patch('user/:id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markAsRead(@CurrentUser('id') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Post('user/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Get('user/unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  // ─── Admin endpoints ──────────────────────────────────────────────────────

  @Get()
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Get all notifications (admin)' })
  findAll(@Query() query: PaginationDto) { return this.notificationsService.findAll(query); }

  @Get(':id')
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Get notification by ID (admin)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.notificationsService.findOne(id); }

  @Post()
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Create notification (admin)' })
  create(@Body() dto: CreateNotificationDto) { return this.notificationsService.create(dto); }

  @Post(':id/send')
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Send notification via FCM (admin)' })
  send(@Param('id', ParseUUIDPipe) id: string) { return this.notificationsService.send(id); }

  @Post('test-push')
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Send a test push notification to a device token (admin)' })
  testPush(@Body() body: TestPushDto) { return this.notificationsService.testPush(body.token); }

  @Delete(':id')
  @Roles('super_admin', 'admin', 'moderator')
  @ApiOperation({ summary: 'Delete notification (admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.notificationsService.remove(id); }
}
