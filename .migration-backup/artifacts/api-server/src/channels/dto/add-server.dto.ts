import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddServerDto {
  @ApiProperty()
  @IsString()
  link: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  streamType?: string;
}
