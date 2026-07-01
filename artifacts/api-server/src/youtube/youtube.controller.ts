import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';
import { YoutubeService } from './youtube.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

class ExtractDto {
  @IsString()
  @IsUrl()
  url!: string;
}

@ApiTags('youtube')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('youtube')
export class YoutubeController {
  constructor(private readonly svc: YoutubeService) {}

  @Post('extract')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Extract direct stream URL from a YouTube link (bypasses embed restrictions)' })
  async extract(@Body() dto: ExtractDto) {
    const result = await this.svc.extractStream(dto.url);
    return result;
  }
}
