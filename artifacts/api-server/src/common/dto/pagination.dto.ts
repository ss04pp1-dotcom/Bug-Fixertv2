import { IsOptional, IsInt, Min, Max, IsString, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  // NOTE: several existing admin/mobile screens request up to limit=500
  // (e.g. categories, sports/tournaments/teams dropdowns, the sports-match
  // channel picker, and the live-player "related channels" list). The
  // global ValidationPipe uses forbidNonWhitelisted + rejects out-of-range
  // values with a 400, so a cap below what real call sites request makes
  // those lists silently fail (empty dropdowns, "No channels match",
  // "No other channels"). Keep this at/above the highest legitimate
  // client-side request instead of guessing a lower "safe" number.
  @Max(500)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  isApproved?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Filter by active status (true/false)' })
  @IsOptional()
  @IsString()
  isActive?: string;

  @ApiPropertyOptional({ description: 'Filter by sport ID (sports module)' })
  @IsOptional()
  @IsString()
  sportId?: string;

  @ApiPropertyOptional({ description: 'Filter by tournament ID (sports module)' })
  @IsOptional()
  @IsString()
  tournamentId?: string;

  @ApiPropertyOptional({ description: 'Filter by match ID (sports module)' })
  @IsOptional()
  @IsString()
  matchId?: string;

  @ApiPropertyOptional({ description: 'Filter by country code' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Filter by device type' })
  @IsOptional()
  @IsString()
  device?: string;

  @ApiPropertyOptional({ description: 'Filter by priority' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: 'Filter by type' })
  @IsOptional()
  @IsString()
  type?: string;

  get skip(): number {
    return ((Number(this.page) || 1) - 1) * (Number(this.limit) || 20);
  }

  /** Always a number — safe to pass directly to Prisma's `take`. */
  get take(): number {
    return Number(this.limit) || 20;
  }
}

export function paginate(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}
