import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() slug: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsNumber() price: number;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiProperty() @IsNumber() durationDays: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() features?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFeatured?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() trialDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sortOrder?: number;
}

export class CreateSubscriptionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() userId?: string;
  @ApiProperty() @IsString() planId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() couponCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gateway?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() autoRenew?: boolean;
}

export class VerifySubscriptionDto {
  @ApiProperty() @IsString() paymentId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() gatewayTxId?: string;
  @ApiPropertyOptional() @IsOptional() metadata?: Record<string, unknown>;
}

export class CreateCouponDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsEnum(['percentage', 'fixed']) discountType: 'percentage' | 'fixed';
  @ApiProperty() @IsNumber() discountValue: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() minPurchase?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() maxUses?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() perUserLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() expiresAt?: Date;
  @ApiPropertyOptional() @IsOptional() @IsArray() planIds?: string[];
}

export class ApplyCouponDto {
  @ApiProperty() @IsString() code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() planId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() userId?: string;
}
