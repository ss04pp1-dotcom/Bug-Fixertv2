import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddCommentaryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  score?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  over?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minute?: number;
}