import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ModerateReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;
}