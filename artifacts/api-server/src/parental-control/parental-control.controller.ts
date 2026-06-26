import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ParentalControlService, SetParentalControlDto } from './parental-control.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Parental Control')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'parental-control', version: '1' })
export class ParentalControlController {
  constructor(private parentalControlService: ParentalControlService) {}

  @Get() @ApiOperation({ summary: 'Get my parental control settings' })
  get(@CurrentUser('id') userId: string) { return this.parentalControlService.get(userId); }

  @Put() @ApiOperation({ summary: 'Update parental control settings' })
  set(@CurrentUser('id') userId: string, @Body() dto: SetParentalControlDto) {
    return this.parentalControlService.set(userId, dto);
  }

  @Post('verify-pin') @ApiOperation({ summary: 'Verify parental PIN' })
  verifyPin(@CurrentUser('id') userId: string, @Body() body: { pin: string }) {
    return this.parentalControlService.verifyPin(userId, body.pin);
  }
}
