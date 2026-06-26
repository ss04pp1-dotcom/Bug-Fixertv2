import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService, CreateRoleDto } from './roles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Roles & Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin')
@Controller({ path: 'roles', version: '1' })
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get() @ApiOperation({ summary: 'Get all roles' })
  findAll() { return this.rolesService.findAll(); }

  @Get('permissions') @ApiOperation({ summary: 'Get all available permissions' })
  getPermissions() { return this.rolesService.getAvailablePermissions(); }

  @Get(':id') @ApiOperation({ summary: 'Get role by ID or name' })
  findOne(@Param('id') id: string) { return this.rolesService.findOne(id); }

  @Post() @ApiOperation({ summary: 'Create role' })
  create(@Body() dto: CreateRoleDto) { return this.rolesService.create(dto); }

  @Put(':id') @ApiOperation({ summary: 'Update role' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateRoleDto>) { return this.rolesService.update(id, dto); }

  @Delete(':id') @Roles('super_admin') @ApiOperation({ summary: 'Delete role' })
  remove(@Param('id') id: string) { return this.rolesService.remove(id); }
}
