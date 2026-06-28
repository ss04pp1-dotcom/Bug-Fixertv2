import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOverridesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cookie?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  origin?: string;
}
