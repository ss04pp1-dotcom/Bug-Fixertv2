import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetSettingDto {
  @ApiProperty()
  @IsString()
  key: string;

  value: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class BulkSettingsDto {
  @ApiProperty({ type: [SetSettingDto] })
  settings: SetSettingDto[];
}

export class TestEmailDto {
  @ApiProperty()
  @IsString()
  to: string;
}