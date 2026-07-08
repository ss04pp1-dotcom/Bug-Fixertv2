import { IsString, IsOptional, IsBoolean, IsDateString, IsNotEmpty, IsEnum, IsArray, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchStatus } from '@prisma/client';

export class CreateMatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  sportId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  tournamentId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  teamAId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  teamBId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streamUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  liveUrl?: string;

  /** Multiple stream URLs — each entry is { label: string; url: string } */
  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  @IsArray()
  streamUrls?: Array<{ label: string; url: string }>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: MatchStatus })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Channel IDs to link to this match (replaces manual stream URLs) */
  @ApiPropertyOptional({ type: 'array', items: { type: 'string', format: 'uuid' } })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  channelIds?: string[];
}