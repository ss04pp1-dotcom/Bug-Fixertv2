import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  identifier: string;

  @ApiProperty()
  @IsString()
  otpCode: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
