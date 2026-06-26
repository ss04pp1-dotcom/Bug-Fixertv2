import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkChannelItemDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty()
  @IsString()
  primaryStreamUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  epgChannelId?: string;

  @ApiPropertyOptional({ enum: ['HLS', 'M3U', 'RTMP', 'DASH'] })
  @IsOptional()
  @IsString()
  streamType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkImportChannelsDto {
  @ApiProperty({ type: [BulkChannelItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkChannelItemDto)
  channels: BulkChannelItemDto[];
}

export class ParsePlaylistDto {
  @ApiProperty()
  @IsString()
  url: string;
}
