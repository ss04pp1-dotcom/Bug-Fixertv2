import { IsString, MinLength, MaxLength } from 'class-validator';
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
  @MaxLength(128) // bcrypt DoS guard
  newPassword: string;
}
