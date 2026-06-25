import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AuditQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by resource name' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({ enum: ['info', 'warning', 'critical'], description: 'Filter by log level' })
  @IsOptional()
  @IsString()
  level?: string;
}
