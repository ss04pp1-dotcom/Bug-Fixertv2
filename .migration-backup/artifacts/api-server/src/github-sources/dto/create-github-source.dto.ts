import { IsString, IsUrl, IsBoolean, IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGitHubSourceDto {
  @IsString()
  name: string;

  @IsUrl({}, { message: 'url must be a valid URL' })
  url: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  syncIntervalMinutes?: number;

  @ApiPropertyOptional({ description: 'Default Cookie header applied to every server synced from this source (entry-level headers take precedence)' })
  @IsOptional()
  @IsString()
  cookie?: string | null;

  @ApiPropertyOptional({ description: 'Default User-Agent header' })
  @IsOptional()
  @IsString()
  userAgent?: string | null;

  @ApiPropertyOptional({ description: 'Default Referer header' })
  @IsOptional()
  @IsString()
  referer?: string | null;

  @ApiPropertyOptional({ description: 'Default Origin header' })
  @IsOptional()
  @IsString()
  origin?: string | null;
}

export class UpdateGitHubSourceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  syncIntervalMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cookie?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referer?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  origin?: string | null;
}
