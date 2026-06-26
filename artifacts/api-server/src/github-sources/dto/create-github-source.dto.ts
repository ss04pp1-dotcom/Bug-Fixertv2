import { IsString, IsUrl, IsBoolean, IsInt, IsOptional, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

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
}
