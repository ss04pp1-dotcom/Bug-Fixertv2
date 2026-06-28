import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Admin-override fields for a GitHub-synced channel.
// Lets admins rename, re-logo, or re-categorise a channel without
// touching the underlying GitHub source record.
export class UpdateOverridesDto {
  @ApiPropertyOptional({ description: 'Override the channel display name' })
  @IsOptional()
  @IsString()
  adminNameOverride?: string | null;

  @ApiPropertyOptional({ description: 'Override the channel logo URL' })
  @IsOptional()
  @IsString()
  adminLogoOverride?: string | null;

  @ApiPropertyOptional({ description: 'Override the assigned category ID' })
  @IsOptional()
  @IsString()
  adminCategoryIdOverride?: string | null;

  @ApiPropertyOptional({ description: 'Alias for adminCategoryIdOverride (shorthand)' })
  @IsOptional()
  @IsString()
  categoryId?: string | null;
}
