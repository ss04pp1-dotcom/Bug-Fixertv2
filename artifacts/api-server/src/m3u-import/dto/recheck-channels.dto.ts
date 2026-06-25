import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RecheckChannelsDto {
  @ApiPropertyOptional({ default: false, description: 'Only recheck offline/failed channels' })
  @IsOptional()
  @IsBoolean()
  offlineOnly?: boolean = false;
}