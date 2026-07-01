import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateServerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

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
