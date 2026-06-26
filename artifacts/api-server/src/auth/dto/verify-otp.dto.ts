import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const OTP_TYPES = ['verify_email', 'verify_phone', 'forgot_password'] as const;

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  identifier: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty({ description: `OTP type: ${OTP_TYPES.join(' | ')}`, enum: OTP_TYPES })
  @IsIn(OTP_TYPES, { message: `type must be one of: ${OTP_TYPES.join(', ')}` })
  type: string;
}
