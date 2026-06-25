import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdType, AdEventType } from '@prisma/client';

export class CreateAdDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional({ enum: AdType }) @IsOptional() @IsEnum(AdType) type?: AdType;
  @ApiPropertyOptional() @IsOptional() @IsString() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() videoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() targetUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() duration?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() providerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() language?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPremium?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDate() @Type(() => Date) startDate?: Date;
  @ApiPropertyOptional() @IsOptional() @IsDate() @Type(() => Date) endDate?: Date;
}

export class CreateAdProviderDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() slug: string;
  @ApiPropertyOptional() @IsOptional() @IsString() apiKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() appId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adUnitBanner?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adUnitInterstitial?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adUnitRewarded?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adUnitNative?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adUnitAppOpen?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isTestMode?: boolean;
  @ApiPropertyOptional() @IsOptional() config?: Record<string, unknown>;
}

export class UpdateAdProviderDto extends CreateAdProviderDto {}

export class CreateAdPlacementDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() type: string;
  @ApiProperty() @IsString() screen: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() frequency?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() cooldownSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() skipAfterSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdateAdSettingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() activeProviderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxAdsPerSession?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxAdsPerDay?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() cooldownSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() minIntervalSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() interstitialEveryNScreens?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() interstitialEveryNMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() rewardedCooldownSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() frequencyCap?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() forceUpdate?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() maintenanceMode?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() maintenanceMessage?: string;
}

export class AdEventDto {
  @ApiPropertyOptional({ enum: AdEventType }) @IsOptional() @IsEnum(AdEventType) eventType?: AdEventType;
  @ApiPropertyOptional() @IsOptional() @IsString() adId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() providerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() placement?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() device?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() os?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() revenue?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() errorCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() errorMsg?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() sessionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() userId?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}
