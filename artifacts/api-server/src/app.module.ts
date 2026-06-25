import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AppCacheModule } from './cache/cache.module';
import { MaintenanceMiddleware } from './common/middleware/maintenance.middleware';
import { RawBodyMiddleware } from './common/middleware/raw-body.middleware';
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
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
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
    AppCacheModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RawBodyMiddleware).forRoutes('/v1/payments/webhook');
    consumer.apply(MaintenanceMiddleware).forRoutes('*');
  }
}
