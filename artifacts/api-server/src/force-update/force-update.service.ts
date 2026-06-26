import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ForceUpdateConfig {
  enabled: boolean;
  minVersionAndroid: string;
  minVersionIos: string;
  currentVersionAndroid: string;
  currentVersionIos: string;
  storeUrlAndroid: string;
  storeUrlIos: string;
  message: string;
  softUpdate: boolean;
}

function semverGt(a: string, b: string): boolean {
  const pa = (a || '0.0.0').split('.').map(Number);
  const pb = (b || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff > 0) return true;
    if (diff < 0) return false;
  }
  return false;
}

@Injectable()
export class ForceUpdateService {
  constructor(private prisma: PrismaService) {}

  async getConfig(): Promise<ForceUpdateConfig> {
    const settings = await this.prisma.setting.findMany({
      where: { key: { startsWith: 'force_update_' } },
    });
    const map: Record<string, unknown> = {};
    for (const s of settings) map[s.key] = s.value;
    return {
      enabled: Boolean(map['force_update_enabled'] ?? false),
      minVersionAndroid: String(map['force_update_min_android'] ?? '1.0.0'),
      minVersionIos: String(map['force_update_min_ios'] ?? '1.0.0'),
      currentVersionAndroid: String(map['force_update_current_android'] ?? '1.0.0'),
      currentVersionIos: String(map['force_update_current_ios'] ?? '1.0.0'),
      storeUrlAndroid: String(map['force_update_store_android'] ?? ''),
      storeUrlIos: String(map['force_update_store_ios'] ?? ''),
      message: String(map['force_update_message'] ?? 'A new version is available. Please update to continue.'),
      softUpdate: Boolean(map['force_update_soft'] ?? false),
    };
  }

  async check(version: string, platform: 'android' | 'ios') {
    const config = await this.getConfig();
    if (!config.enabled) {
      return { needsUpdate: false, isSoft: false, config };
    }
    const minVersion = platform === 'ios' ? config.minVersionIos : config.minVersionAndroid;
    const latestVersion = platform === 'ios' ? config.currentVersionIos : config.currentVersionAndroid;
    const storeUrl = platform === 'ios' ? config.storeUrlIos : config.storeUrlAndroid;
    const needsUpdate = semverGt(minVersion, version);
    const isSoft = !needsUpdate && semverGt(latestVersion, version);
    return {
      needsUpdate,
      isSoft: config.softUpdate && isSoft,
      latestVersion,
      storeUrl,
      message: config.message,
    };
  }

  async setConfig(config: Partial<ForceUpdateConfig>) {
    const keyMap: Record<keyof ForceUpdateConfig, string> = {
      enabled: 'force_update_enabled',
      minVersionAndroid: 'force_update_min_android',
      minVersionIos: 'force_update_min_ios',
      currentVersionAndroid: 'force_update_current_android',
      currentVersionIos: 'force_update_current_ios',
      storeUrlAndroid: 'force_update_store_android',
      storeUrlIos: 'force_update_store_ios',
      message: 'force_update_message',
      softUpdate: 'force_update_soft',
    };
    const ops = Object.entries(config).map(([k, v]) => {
      const key = keyMap[k as keyof ForceUpdateConfig];
      if (!key) return null;
      return this.prisma.setting.upsert({
        where: { key },
        create: { key, value: v as import('@prisma/client').Prisma.InputJsonValue, isPublic: true },
        update: { value: v as import('@prisma/client').Prisma.InputJsonValue },
      });
    }).filter(Boolean);
    await Promise.all(ops);
    return this.getConfig();
  }
}
