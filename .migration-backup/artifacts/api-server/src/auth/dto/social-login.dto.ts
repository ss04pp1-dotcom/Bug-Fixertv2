import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({ enum: ['google', 'facebook', 'apple'], description: 'OAuth provider name' })
  @IsString()
  @IsIn(['google', 'facebook', 'apple'])
  provider: string;

  @ApiProperty({ description: 'Access token or ID token from the OAuth provider' })
  @IsString()
  accessToken: string;

  @ApiPropertyOptional({ description: 'User email from the provider' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'User display name from the provider' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Provider-specific user ID (sub / uid)' })
  @IsOptional()
  @IsString()
  providerId?: string;
}
