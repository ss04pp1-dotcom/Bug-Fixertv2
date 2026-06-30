import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsUrl } from 'class-validator';
import { YoutubeService } from './youtube.service';

class ExtractDto {
  @IsString()
  @IsUrl()
  url!: string;
}

@ApiTags('youtube')
@ApiBearerAuth()
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
