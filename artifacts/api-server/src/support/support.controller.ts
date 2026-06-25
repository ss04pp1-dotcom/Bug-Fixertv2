import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'support', version: '1' })
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('stats') @Roles('super_admin', 'admin', 'moderator') @ApiOperation({ summary: 'Ticket stats (admin)' })
  getStats() { return this.supportService.getStats(); }

  @Get() @Roles('super_admin', 'admin', 'moderator') @ApiOperation({ summary: 'List tickets (admin)' })
  findAll(@Query('status') status?: string, @Query('priority') priority?: string,
          @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.supportService.findAll({ status, priority, page: Number(page) || 1, limit: Number(limit) || 20 });
  }

  @Get(':id') @Roles('super_admin', 'admin', 'moderator') @ApiOperation({ summary: 'Get ticket (admin)' })
  findOne(@Param('id') id: string) { return this.supportService.findOne(id); }

  @Post() @Roles('user', 'premium', 'moderator', 'admin', 'super_admin') @ApiOperation({ summary: 'Create ticket' })
  create(@Body() dto: { userEmail: string; subject: string; description?: string; priority?: string }) {
    return this.supportService.create(dto);
  }

  @Put(':id') @Roles('super_admin', 'admin', 'moderator') @ApiOperation({ summary: 'Update ticket (admin)' })
  update(@Param('id') id: string, @Body() dto: { status?: string; priority?: string; assignedTo?: string }) {
    return this.supportService.update(id, dto);
  }

  @Delete(':id') @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Delete ticket (admin)' })
  remove(@Param('id') id: string) { return this.supportService.remove(id); }
}
