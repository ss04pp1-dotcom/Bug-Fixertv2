import { IsString, IsOptional, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDownloadDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @IsIn(['movie', 'series', 'episode'])
  contentType: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  contentId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  poster?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  streamUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['360p', '480p', '720p', '1080p', '4k'])
  quality?: string;
}