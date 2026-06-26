import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class UploadM3uDto {
  @ApiPropertyOptional({ default: 50, description: 'Number of channels to validate per batch' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(200)
  batchSize?: number = 50;

  @ApiPropertyOptional({ default: false, description: 'Save failed channels to database' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  saveFailed?: boolean = false;
}