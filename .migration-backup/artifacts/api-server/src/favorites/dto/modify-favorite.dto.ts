import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// A-054: replace inline anonymous body type with a validated DTO so
// ValidationPipe whitelist can reject unexpected/injected fields and
// class-validator can enforce UUID format on each content ID.
export class ModifyFavoriteDto {
  @ApiPropertyOptional({ description: 'Channel ID to add/remove' })
  @IsOptional()
  @IsUUID()
  channelId?: string;

  @ApiPropertyOptional({ description: 'Movie ID to add/remove' })
  @IsOptional()
  @IsUUID()
  movieId?: string;

  @ApiPropertyOptional({ description: 'Series ID to add/remove' })
  @IsOptional()
  @IsUUID()
  seriesId?: string;
}
