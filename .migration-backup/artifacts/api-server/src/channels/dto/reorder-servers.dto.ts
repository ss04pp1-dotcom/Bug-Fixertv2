import { IsArray, IsString, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderServerItemDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  priority: number;
}

export class ReorderServersDto {
  @ApiProperty({ type: [ReorderServerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderServerItemDto)
  servers: ReorderServerItemDto[];
}
