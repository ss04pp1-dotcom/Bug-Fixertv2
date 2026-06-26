import { Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { SetSettingDto, BulkSettingsDto, TestEmailDto } from './dto/set-setting.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Public() @Get('public') @ApiOperation({ summary: 'Get public settings' })
  getPublic() { return this.settingsService.getAll(true); }

  @Public() @Get('app-config') @ApiOperation({ summary: 'Get app remote config' })
  getAppConfig() { return this.settingsService.getAppConfig(); }

  @Get() @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get all settings' })
  getAll() { return this.settingsService.getAll(); }

  @Get(':key') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Get setting by key' })
  get(@Param('key') key: string) { return this.settingsService.get(key); }

  @Post() @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Set a setting' })
  set(@Body() dto: SetSettingDto) {
    return this.settingsService.set(dto.key, dto.value as import('@prisma/client').Prisma.InputJsonValue, dto.description, dto.isPublic);
  }

  @Post('bulk') @ApiBearerAuth() @Roles('super_admin', 'admin') @ApiOperation({ summary: 'Bulk upsert settings' })
  bulk(@Body() dto: BulkSettingsDto) {
    return this.settingsService.bulkSave(
      dto.settings.map(s => ({ key: s.key, value: s.value as import('@prisma/client').Prisma.InputJsonValue, isPublic: s.isPublic }))
    );
  }

  @Post('test-email') @ApiBearerAuth() @Roles('super_admin', 'admin') @HttpCode(200) @ApiOperation({ summary: 'Test SMTP configuration' })
  testEmail(@Body() dto: TestEmailDto) { return this.settingsService.testEmail(dto.to); }

  @Post('storage/test') @ApiBearerAuth() @Roles('super_admin', 'admin') @HttpCode(200) @ApiOperation({ summary: 'Test storage configuration' })
  testStorage() { return this.settingsService.testStorage(); }

  @Delete(':key') @ApiBearerAuth() @Roles('super_admin') @ApiOperation({ summary: 'Delete setting' })
  delete(@Param('key') key: string) { return this.settingsService.delete(key); }
}
