import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { IsString, IsOptional, IsBoolean, IsArray, MinLength } from 'class-validator';

export class SetParentalControlDto {
  @IsOptional() @IsString() @MinLength(4) pin?: string;
  @IsOptional() @IsString() maxAgeRating?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) restrictedCategories?: string[];
  @IsOptional() @IsBoolean() isEnabled?: boolean;
}

@Injectable()
export class ParentalControlService {
  constructor(private prisma: PrismaService) {}

  async get(userId: string) {
    const setting = await this.prisma.parentalSetting.findUnique({ where: { userId } });
    if (!setting) return { userId, isEnabled: false, pin: null, maxAgeRating: null, restrictedCategories: [] };
    const { pin, ...rest } = setting;
    return { ...rest, pinSet: !!pin };
  }

  async set(userId: string, dto: SetParentalControlDto) {
    // A-046: explicitly extract `pin` from the spread so an empty-string pin (which
    // previously flowed through `...dto` into the data object and overwrote any
    // existing hash with the empty string) is now ignored. Only hash & persist the
    // pin when the caller explicitly provided a non-empty value.
    const { pin, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (pin) {
      data['pin'] = await bcrypt.hash(pin, 10);
    }

    return this.prisma.parentalSetting.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async verifyPin(userId: string, pin: string) {
    const setting = await this.prisma.parentalSetting.findUnique({ where: { userId } });
    if (!setting || !setting.pin) throw new NotFoundException('PIN not set');
    const valid = await bcrypt.compare(pin, setting.pin);
    if (!valid) throw new UnauthorizedException('Invalid PIN');
    return { valid: true };
  }
}
