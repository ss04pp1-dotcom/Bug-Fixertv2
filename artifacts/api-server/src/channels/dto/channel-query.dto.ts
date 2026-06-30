import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ChannelQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter premium channels (true/false)' })
  @IsOptional()
  @IsString()
  isPremium?: string;

  @ApiPropertyOptional({ description: 'Filter featured channels (true/false)' })
  @IsOptional()
  @IsString()
  isFeatured?: string;
}
