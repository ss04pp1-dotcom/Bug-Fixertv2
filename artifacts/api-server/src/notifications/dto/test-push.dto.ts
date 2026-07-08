import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TestPushDto {
  @ApiProperty({ description: 'FCM device token to receive the test push' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}
