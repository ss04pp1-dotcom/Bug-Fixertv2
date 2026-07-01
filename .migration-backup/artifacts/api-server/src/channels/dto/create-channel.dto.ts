import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HealthOverride } from '@prisma/client';

export class CreateChannelDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thumbnail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  banner?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryStreamUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  backupStreamUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  thirdBackupUrl?: string;

  @ApiPropertyOptional({ enum: ['HLS', 'M3U', 'RTMP', 'DASH'] })
  @IsOptional()
  @IsString()
  streamType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  epgChannelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTrending?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isLive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({ enum: ['AUTO', 'FORCE_HEALTHY', 'FORCE_OFFLINE'], description: 'Manual health override' })
  @IsOptional()
  @IsEnum(HealthOverride)
  healthOverride?: HealthOverride;
}
