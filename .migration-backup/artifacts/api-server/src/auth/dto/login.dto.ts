import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Email or phone number' })
  @IsString()
  identifier: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platform?: string;
}
