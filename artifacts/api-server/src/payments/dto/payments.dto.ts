import { IsString, IsNumber, IsOptional, IsBoolean, IsObject, IsArray } from 'class-validator';

export class CreatePaymentDto {
  @IsOptional() @IsString()
  userId?: string;
  @IsOptional() @IsString()
  subscriptionId?: string;
  @IsString()
  gateway: string;
  @IsNumber()
  amount: number;
  @IsOptional() @IsString()
  currency?: string;
  @IsOptional() @IsString()
  gatewayTxId?: string;
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class RefundDto {
  @IsOptional() @IsString()
  reason?: string;
}

export class WebhookDto {
  @IsOptional() @IsString()
  gateway?: string;
  @IsOptional() @IsString()
  event?: string;
  @IsOptional() @IsString()
  transactionId?: string;
  @IsOptional() @IsString()
  status?: string;
  @IsOptional() @IsNumber()
  amount?: number;
  @IsOptional() @IsString()
  currency?: string;
  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpsertGatewayDto {
  @IsString()
  slug: string;
  @IsOptional() @IsString()
  name?: string;
  @IsOptional() @IsBoolean()
  isActive?: boolean;
  @IsOptional() @IsBoolean()
  isTestMode?: boolean;
  @IsOptional() @IsString()
  publicKey?: string;
  @IsOptional() @IsString()
  secretKey?: string;
  @IsOptional() @IsString()
  webhookSecret?: string;
  @IsOptional() @IsObject()
  config?: Record<string, unknown>;
  @IsOptional() @IsNumber()
  feePercent?: number;
  @IsOptional() @IsNumber()
  fixedFee?: number;
  @IsOptional() @IsArray()
  currencies?: string[];
  @IsOptional() @IsArray()
  countries?: string[];
}

export class CreateGatewayDto {
  @IsString()
  name: string;
  @IsString()
  slug: string;
  @IsOptional() @IsBoolean()
  isActive?: boolean;
  @IsOptional() @IsBoolean()
  isTestMode?: boolean;
  @IsOptional() @IsString()
  publicKey?: string;
  @IsOptional() @IsString()
  secretKey?: string;
  @IsOptional() @IsString()
  webhookSecret?: string;
  @IsOptional() @IsObject()
  config?: Record<string, unknown>;
  @IsOptional() @IsNumber()
  feePercent?: number;
  @IsOptional() @IsNumber()
  fixedFee?: number;
  @IsOptional() @IsArray()
  currencies?: string[];
  @IsOptional() @IsArray()
  countries?: string[];
}