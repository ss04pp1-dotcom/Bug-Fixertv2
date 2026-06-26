import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export class SetParentalControlDto {
  pin?: string;
  maxAgeRating?: string;
  restrictedCategories?: string[];
  isEnabled?: boolean;
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
    const data: Record<string, unknown> = { ...dto };
    if (dto.pin) data['pin'] = await bcrypt.hash(dto.pin, 10);

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
