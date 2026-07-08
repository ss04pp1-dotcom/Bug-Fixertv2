import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AppCacheModule } from './cache/cache.module';
import { MaintenanceMiddleware } from './common/middleware/maintenance.middleware';
import { RawBodyMiddleware } from './common/middleware/raw-body.middleware';
import { LocaleMiddleware } from './common/middleware/locale.middleware';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { ChannelsModule } from './channels/channels.module';
import { MoviesModule } from './movies/movies.module';
import { SeriesModule } from './series/series.module';
import { EpgModule } from './epg/epg.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AdvertisementsModule } from './advertisements/advertisements.module';
import { FavoritesModule } from './favorites/favorites.module';
import { WatchHistoryModule } from './watch-history/watch-history.module';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettingsModule } from './settings/settings.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { RolesModule } from './roles/roles.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { GeoBlockModule } from './geo-block/geo-block.module';
import { ParentalControlModule } from './parental-control/parental-control.module';
import { WebsocketModule } from './websocket/websocket.module';
import { StorageModule } from './storage/storage.module';
import { BannersModule } from './banners/banners.module';
import { ForceUpdateModule } from './force-update/force-update.module';
import { ReportsModule } from './reports/reports.module';
import { SupportModule } from './support/support.module';
import { SportsModule } from './sports/sports.module';
import { DownloadsModule } from './downloads/downloads.module';
import { ReviewsModule } from './reviews/reviews.module';
import { JobsModule } from './jobs/jobs.module';
import { M3uImportModule } from './m3u-import/m3u-import.module';
import { PlaybackEventsModule } from './playback-events/playback-events.module';
import { GitHubSourcesModule } from './github-sources/github-sources.module';
import { GitHubSyncModule } from './github-sync/github-sync.module';
import { YoutubeModule } from './youtube/youtube.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },   // 10 req/sec burst
      { name: 'medium', ttl: 60_000, limit: 100 }, // 100 req/min sustained
      { name: 'long', ttl: 3_600_000, limit: 1000 }, // 1000 req/hr total
    ]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ChannelsModule,
    MoviesModule,
    SeriesModule,
    EpgModule,
    SubscriptionsModule,
    PaymentsModule,
    NotificationsModule,
    AnnouncementsModule,
    AdvertisementsModule,
    FavoritesModule,
    WatchHistoryModule,
    SearchModule,
    AnalyticsModule,
    SettingsModule,
    FeatureFlagsModule,
    RolesModule,
    AuditModule,
    HealthModule,
    GeoBlockModule,
    ParentalControlModule,
    WebsocketModule,
    StorageModule,
    BannersModule,
    ForceUpdateModule,
    ReportsModule,
    SupportModule,
    SportsModule,
    DownloadsModule,
    ReviewsModule,
    JobsModule,
    M3uImportModule,
    PlaybackEventsModule,
    AppCacheModule,
    GitHubSyncModule,
    GitHubSourcesModule,
    YoutubeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Register JwtAuthGuard globally so EVERY endpoint requires authentication by default.
    // The guard already checks IS_PUBLIC_KEY metadata and short-circuits for @Public() routes,
    // so existing public endpoints (login, register, /healthz, etc.) keep working unchanged.
    // RolesGuard is intentionally NOT registered globally — it's only applied per-controller
    // where @Roles() is actually used, to avoid surprising 403s on routes that don't declare roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RawBodyMiddleware).forRoutes('/v1/payments/webhook');
    consumer.apply(MaintenanceMiddleware).forRoutes('*');
    // Attach req.locale from Accept-Language header — used by services for i18n error messages.
    consumer.apply(LocaleMiddleware).forRoutes('*');
  }
}
