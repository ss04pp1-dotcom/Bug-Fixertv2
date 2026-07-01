import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, AdEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto, paginate } from '../common/dto/pagination.dto';
import {
  CreateAdDto, CreateAdProviderDto, UpdateAdProviderDto,
  CreateAdPlacementDto, AdEventDto, UpdateAdSettingDto,
} from './dto/advertisements.dto';

const AD_SETTING_KEY = 'global';

@Injectable()
export class AdvertisementsService {
  private readonly logger = new Logger(AdvertisementsService.name);
  constructor(private prisma: PrismaService) {}

  async findAll(query: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.advertisement.findMany({
        skip: query.skip, take: query.limit || 20, orderBy: { createdAt: 'desc' },
        include: { provider: true },
      }),
      this.prisma.advertisement.count(),
    ]);
    return { data, meta: paginate(total, query.page || 1, query.limit || 20) };
  }

  async getActive(country?: string) {
    const now = new Date();
    const andConditions: Prisma.AdvertisementWhereInput[] = [
      { OR: [{ startDate: null }, { startDate: { lte: now } }] },
      { OR: [{ endDate: null }, { endDate: { gte: now } }] },
    ];
    if (country) {
      andConditions.push({ OR: [{ country }, { country: null }] });
    }
    const where: Prisma.AdvertisementWhereInput = {
      isActive: true,
      AND: andConditions,
    };
    return this.prisma.advertisement.findMany({ where, include: { provider: true } });
  }

  async create(dto: CreateAdDto) {
    return this.prisma.advertisement.create({ data: dto as Prisma.AdvertisementCreateInput });
  }

  async update(id: string, dto: Partial<CreateAdDto>) {
    return this.prisma.advertisement.update({ where: { id }, data: dto as Prisma.AdvertisementUpdateInput });
  }

  async remove(id: string) {
    await this.prisma.advertisement.delete({ where: { id } });
    return { message: 'Advertisement deleted' };
  }

  async trackImpression(id: string) {
    await this.prisma.advertisement.update({ where: { id }, data: { impressions: { increment: 1 } } });
    return { tracked: true };
  }

  async trackClick(id: string) {
    await this.prisma.advertisement.update({ where: { id }, data: { clicks: { increment: 1 } } });
    return { tracked: true };
  }

  // Slugs must match the adProviders array in prisma/seed.ts exactly
  private static readonly DEFAULT_PROVIDERS = [
    { name: 'Google AdMob',              slug: 'admob'      },
    { name: 'Meta Audience Network',     slug: 'meta'       },
    { name: 'Unity Ads',                 slug: 'unity'      },
    { name: 'IronSource',                slug: 'ironsource' },
    { name: 'AppLovin MAX',              slug: 'applovin'   },
    { name: 'Adsterra',                  slug: 'adsterra'   },
    { name: 'Start.io',                  slug: 'startio'    },
    { name: 'Pangle (TikTok)',           slug: 'pangle'     },
    { name: 'Amazon Publisher Services', slug: 'amazon'     },
    { name: 'House Ads',                 slug: 'house'      },
    { name: 'Custom Ad Network',         slug: 'custom'     },
  ];

  async seedDefaultProviders() {
    let seeded = 0;
    for (const p of AdvertisementsService.DEFAULT_PROVIDERS) {
      const exists = await this.prisma.adProvider.findUnique({ where: { slug: p.slug } });
      if (!exists) {
        await this.prisma.adProvider.create({ data: { name: p.name, slug: p.slug } });
        seeded++;
      }
    }
    const all = await this.prisma.adProvider.findMany({ orderBy: { name: 'asc' } });
    return { seeded, total: all.length, providers: all };
  }

  async getProviders() {
    return this.prisma.adProvider.findMany({ orderBy: { name: 'asc' } });
  }

  async createProvider(dto: CreateAdProviderDto) {
    return this.prisma.adProvider.create({ data: dto as Prisma.AdProviderCreateInput });
  }

  async updateProvider(id: string, dto: UpdateAdProviderDto) {
    return this.prisma.adProvider.update({ where: { id }, data: dto as Prisma.AdProviderUpdateInput });
  }

  async deleteProvider(id: string) {
    await this.prisma.adProvider.delete({ where: { id } });
    return { message: 'Provider deleted' };
  }

  async activateProvider(id: string) {
    // A-034: wrap the "deselect all" + "select this one" in a single transaction so a crash
    // between them cannot leave the system in a state where NO provider is selected (or,
    // worse, where two are). The updateMany is scoped to `isSelected: true` so we only
    // touch providers that are currently the active one — previously the unscoped
    // `updateMany({ data: { isSelected: false } })` flipped every provider's isSelected
    // flag (including providers the admin explicitly deactivated).
    const provider = await this.prisma.$transaction(async (tx) => {
      await tx.adProvider.updateMany({
        where: { isSelected: true },
        data: { isSelected: false },
      });
      return tx.adProvider.update({
        where: { id },
        data: { isSelected: true, isActive: true },
      });
    });
    await this.upsertSettings({ activeProviderId: id });
    return provider;
  }

  async getPublicPlacements(slug?: string) {
    const where: Prisma.AdPlacementWhereInput = { isEnabled: true };
    if (slug) where.slug = slug;

    const placements = await this.prisma.adPlacement.findMany({ where });
    if (placements.length === 0) return [];

    const now = new Date();
    const activeAds = await this.prisma.advertisement.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      include: { provider: true },
    });

    return placements.map(pl => ({
      ...pl,
      advertisements: activeAds.filter(ad => ad.type === pl.type),
    }));
  }

  async getPlacements() {
    return this.prisma.adPlacement.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  }

  async createPlacement(dto: CreateAdPlacementDto) {
    return this.prisma.adPlacement.create({ data: dto as Prisma.AdPlacementCreateInput });
  }

  async updatePlacement(id: string, dto: Partial<CreateAdPlacementDto>) {
    return this.prisma.adPlacement.update({ where: { id }, data: dto as Prisma.AdPlacementUpdateInput });
  }

  async deletePlacement(id: string) {
    await this.prisma.adPlacement.delete({ where: { id } });
    return { message: 'Placement deleted' };
  }

  async getSettings() {
    return this.prisma.adSetting.findUnique({ where: { key: AD_SETTING_KEY } });
  }

  async upsertSettings(dto: UpdateAdSettingDto) {
    return this.prisma.adSetting.upsert({
      where: { key: AD_SETTING_KEY },
      update: dto as Prisma.AdSettingUpdateInput,
      create: { key: AD_SETTING_KEY, ...dto } as Prisma.AdSettingCreateInput,
    });
  }

  async updateSettings(dto: UpdateAdSettingDto) {
    return this.upsertSettings(dto);
  }

  async getRemoteConfig() {
    const [settings, activeProvider, placements, features] = await Promise.all([
      this.prisma.adSetting.findUnique({ where: { key: AD_SETTING_KEY } }),
      this.prisma.adProvider.findFirst({ where: { isSelected: true, isActive: true } }),
      this.prisma.adPlacement.findMany({ where: { isEnabled: true } }),
      this.prisma.featureFlag.findMany({ where: { isEnabled: true } }),
    ]);

    const placementMap: Record<string, Record<string, unknown>> = {};
    for (const p of placements) {
      placementMap[p.slug] = {
        enabled: p.isEnabled, type: p.type, screen: p.screen,
        frequency: p.frequency, cooldownSeconds: p.cooldownSeconds,
        skipAfterSeconds: p.skipAfterSeconds,
      };
    }

    const featureMap: Record<string, boolean> = {};
    for (const f of features) featureMap[f.name] = f.isEnabled;

    return {
      activeProvider: activeProvider ? {
        slug: activeProvider.slug,
        name: activeProvider.name,
        appId: activeProvider.appId,
        adUnits: {
          banner: activeProvider.adUnitBanner,
          interstitial: activeProvider.adUnitInterstitial,
          rewarded: activeProvider.adUnitRewarded,
          native: activeProvider.adUnitNative,
          appOpen: activeProvider.adUnitAppOpen,
        },
        isTestMode: activeProvider.isTestMode,
      } : null,
      placements: placementMap,
      frequency: settings ? {
        maxAdsPerSession: settings.maxAdsPerSession,
        maxAdsPerDay: settings.maxAdsPerDay,
        cooldownSeconds: settings.cooldownSeconds,
        minIntervalSeconds: settings.minIntervalSeconds,
        interstitialEveryNScreens: settings.interstitialEveryNScreens,
        interstitialEveryNMinutes: settings.interstitialEveryNMinutes,
        rewardedCooldownSeconds: settings.rewardedCooldownSeconds,
        frequencyCap: settings.frequencyCap,
      } : null,
      adsEnabled: settings?.isEnabled ?? true,
      forceUpdate: settings?.forceUpdate ?? false,
      maintenanceMode: settings?.maintenanceMode ?? false,
      maintenanceMessage: settings?.maintenanceMessage ?? null,
      featureFlags: featureMap,
      timestamp: new Date().toISOString(),
    };
  }

  async trackEvent(eventType: string, dto: AdEventDto, req: { headers?: Record<string, string | string[] | undefined> }) {
    const country = dto.country ?? (req.headers?.['cf-ipcountry'] as string | undefined) ?? null;
    const event = await this.prisma.adEvent.create({
      data: {
        eventType: eventType as AdEventType,
        adId: dto.adId || null,
        providerId: dto.providerId || null,
        placement: dto.placement || null,
        country,
        device: dto.device || null,
        os: dto.os || null,
        revenue: dto.revenue || null,
        errorCode: dto.errorCode || null,
        errorMsg: dto.errorMsg || null,
        sessionId: dto.sessionId || null,
        userId: dto.userId || null,
        metadata: dto.metadata !== undefined ? (dto.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });

    if (dto.adId) {
      if (eventType === 'impression') {
        await this.prisma.advertisement.update({ where: { id: dto.adId }, data: { impressions: { increment: 1 } } }).catch((e: Error) => this.logger.warn(`Failed to increment impressions: ${e.message}`));
      } else if (eventType === 'click') {
        await this.prisma.advertisement.update({ where: { id: dto.adId }, data: { clicks: { increment: 1 } } }).catch((e: Error) => this.logger.warn(`Failed to increment clicks: ${e.message}`));
      }
    }

    if (eventType === 'revenue' && dto.revenue) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      await this.prisma.adRevenue.upsert({
        where: {
          date_providerId_placement_country_device_os: {
            date: today,
            providerId: (dto.providerId ?? null) as string,
            placement: (dto.placement ?? null) as string,
            country: (country ?? null) as string,
            device: (dto.device ?? null) as string,
            os: (dto.os ?? null) as string,
          },
        },
        update: { revenue: { increment: dto.revenue } },
        create: {
          date: today,
          providerId: dto.providerId ?? null,
          placement: dto.placement ?? null,
          country: country ?? null,
          device: dto.device ?? null,
          os: dto.os ?? null,
          revenue: dto.revenue, impressions: 0, clicks: 0,
        },
      }).catch((e: Error) => this.logger.warn(`Failed to upsert ad revenue: ${e.message}`));
    }

    return { tracked: true, eventId: event.id };
  }

  async seedDemoAnalytics() {
    const providers = await this.prisma.adProvider.findMany({ take: 9 });
    if (providers.length === 0) {
      return { error: 'No providers found — seed providers first via POST /providers/seed' };
    }

    const PLACEMENTS  = ['home_banner', 'player_preroll', 'channel_interstitial', 'search_banner', 'live_banner'];
    const COUNTRIES   = ['US', 'GB', 'DE', 'FR', 'CA'];
    const DEVICES     = ['mobile', 'tablet'];
    const OS_LIST     = ['ios', 'android'];

    // Weighted provider share (first provider gets most traffic)
    const providerWeights = providers.map((_, i) => Math.max(0.05, 1 - i * 0.15));
    const totalWeight     = providerWeights.reduce((a, b) => a + b, 0);

    const revenueRows: Prisma.AdRevenueCreateManyInput[] = [];
    const eventRows:   Prisma.AdEventCreateManyInput[]   = [];

    const now = new Date();
    for (let day = 29; day >= 0; day--) {
      const date = new Date(now);
      date.setDate(date.getDate() - day);
      date.setHours(0, 0, 0, 0);

      // Day-of-week multiplier (weekends ~30% more)
      const dow = date.getDay();
      const dayMult = (dow === 0 || dow === 6) ? 1.3 : 1.0;
      // Recent-day ramp (last 7 days show growth)
      const rampMult = day < 7 ? 1 + (7 - day) * 0.05 : 1.0;

      for (let pi = 0; pi < Math.min(providers.length, 4); pi++) {
        const provider = providers[pi];
        const provShare = providerWeights[pi] / totalWeight;

        for (const placement of PLACEMENTS) {
          const isFullScreen = placement.includes('interstitial') || placement.includes('preroll');
          const baseCpm = isFullScreen ? 4.5 : 1.8; // eCPM in $

          for (const country of COUNTRIES) {
            const countryMult = country === 'US' ? 1.6 : country === 'GB' ? 1.3 : country === 'DE' ? 1.1 : 0.8;
            for (const device of DEVICES) {
              const deviceMult = device === 'tablet' ? 1.15 : 1.0;
              for (const os of OS_LIST) {
                const baseImpressions = Math.round(
                  (80 + Math.random() * 120) * dayMult * rampMult * provShare * countryMult * deviceMult
                );
                if (baseImpressions < 1) continue;
                const ctr       = 0.02 + Math.random() * 0.04; // 2-6%
                const clicks    = Math.round(baseImpressions * ctr);
                const revenue   = (baseImpressions / 1000) * baseCpm * countryMult * deviceMult * (0.9 + Math.random() * 0.2);

                revenueRows.push({
                  date,
                  providerId: provider.id,
                  placement,
                  country,
                  device,
                  os,
                  impressions: baseImpressions,
                  clicks,
                  revenue: Math.round(revenue * 1000) / 1000,
                });

                // Sprinkle a few AdEvent rows for this slot
                const eventSamples = Math.min(Math.round(baseImpressions * 0.03), 8);
                for (let e = 0; e < eventSamples; e++) {
                  const eventDate = new Date(date);
                  eventDate.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
                  const rnd = Math.random();
                  const eventType: AdEventType =
                    rnd < 0.70 ? 'impression' : rnd < 0.92 ? 'click' : 'error';
                  eventRows.push({
                    eventType,
                    providerId: provider.id,
                    placement,
                    country,
                    device,
                    os,
                    revenue: eventType === 'impression' ? revenue / baseImpressions : undefined,
                    createdAt: eventDate,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Batch insert in chunks to avoid hitting Postgres parameter limits
    const CHUNK = 500;
    let revenueCreated = 0;
    for (let i = 0; i < revenueRows.length; i += CHUNK) {
      const r = await this.prisma.adRevenue.createMany({ data: revenueRows.slice(i, i + CHUNK), skipDuplicates: true });
      revenueCreated += r.count;
    }
    let eventsCreated = 0;
    for (let i = 0; i < eventRows.length; i += CHUNK) {
      const r = await this.prisma.adEvent.createMany({ data: eventRows.slice(i, i + CHUNK) });
      eventsCreated += r.count;
    }

    return {
      revenueRowsInserted: revenueCreated,
      eventRowsInserted:   eventsCreated,
      daysSeeded:          30,
      providersUsed:       Math.min(providers.length, 4),
    };
  }

  async resetAnalytics() {
    const [events, revenue] = await Promise.all([
      this.prisma.adEvent.deleteMany({}),
      this.prisma.adRevenue.deleteMany({}),
    ]);
    return { deletedEvents: events.count, deletedRevenueRows: revenue.count };
  }

  async getAnalytics(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const [totalImpressions, totalClicks, revenue, byPlacement, byCountry, byProvider] = await Promise.all([
      this.prisma.adEvent.count({ where: { eventType: 'impression', createdAt: { gte: fromDate, lte: toDate } } }),
      this.prisma.adEvent.count({ where: { eventType: 'click', createdAt: { gte: fromDate, lte: toDate } } }),
      this.prisma.adRevenue.aggregate({ _sum: { revenue: true, impressions: true, clicks: true }, where: { date: { gte: fromDate, lte: toDate } } }),
      this.prisma.adRevenue.groupBy({ by: ['placement'], _sum: { revenue: true, impressions: true, clicks: true }, where: { date: { gte: fromDate, lte: toDate } }, orderBy: { _sum: { revenue: 'desc' } }, take: 10 }),
      this.prisma.adRevenue.groupBy({ by: ['country'], _sum: { revenue: true, impressions: true }, where: { date: { gte: fromDate, lte: toDate } }, orderBy: { _sum: { revenue: 'desc' } }, take: 10 }),
      this.prisma.adRevenue.groupBy({ by: ['providerId'], _sum: { revenue: true, impressions: true, clicks: true }, where: { date: { gte: fromDate, lte: toDate } }, orderBy: { _sum: { revenue: 'desc' } } }),
    ]);

    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';
    const totalRevenue = revenue._sum.revenue || 0;
    const ecpm = (revenue._sum.impressions || 0) > 0 ? ((totalRevenue / (revenue._sum.impressions || 1)) * 1000).toFixed(2) : '0.00';

    return {
      summary: { totalImpressions, totalClicks, ctr: `${ctr}%`, totalRevenue, ecpm: `$${ecpm}` },
      byPlacement, byCountry, byProvider,
    };
  }
}
