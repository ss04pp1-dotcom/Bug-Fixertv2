import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({ enum: ['google', 'facebook', 'apple'], description: 'OAuth provider name' })
  @IsString()
  @IsIn(['google', 'facebook', 'apple'])
  provider: string;

  @ApiPropertyOptional({ description: 'Access token or ID token from the OAuth provider (required unless code/redirectUri are sent for a server-side exchange)' })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional({ description: 'OAuth authorization code (Facebook PKCE flow) — exchanged server-side using the private client secret/token' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: 'Redirect URI used when requesting the authorization code — must match exactly for the token exchange' })
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @ApiPropertyOptional({ description: 'PKCE code verifier used when requesting the authorization code' })
  @IsOptional()
  @IsString()
  codeVerifier?: string;

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
