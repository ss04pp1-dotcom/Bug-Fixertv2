import {
  pgTable, pgEnum, uuid, text, boolean, integer,
  real, timestamp, date, json, index, unique,
} from 'drizzle-orm/pg-core';

// ─── Enums ───────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'super_admin', 'admin', 'moderator', 'editor', 'support', 'user',
]);

export const streamTypeEnum = pgEnum('stream_type', ['HLS', 'M3U', 'RTMP', 'DASH']);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'inactive', 'active', 'expired', 'cancelled', 'trial', 'pending', 'refunded',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'completed', 'failed', 'refunded',
]);

export const notificationTypeEnum = pgEnum('notification_type', [
  'push', 'in_app', 'email', 'sms',
]);

export const adTypeEnum = pgEnum('ad_type', [
  'banner', 'video', 'popup', 'interstitial', 'rewarded', 'native', 'app_open', 'splash',
]);

export const adEventTypeEnum = pgEnum('ad_event_type', [
  'impression', 'click', 'error', 'session', 'revenue',
]);

export const couponDiscountTypeEnum = pgEnum('coupon_discount_type', [
  'percentage', 'fixed',
]);

export const auditLevelEnum = pgEnum('audit_level', ['info', 'warning', 'critical']);

export const channelStreamStatusEnum = pgEnum('channel_stream_status', [
  'pending', 'checking', 'active', 'offline', 'failed',
]);

export const importJobStatusEnum = pgEnum('import_job_status', [
  'pending', 'parsing', 'validating', 'completing', 'completed', 'failed', 'cancelled',
]);

export const importChannelStatusEnum = pgEnum('import_channel_status', [
  'pending', 'checking', 'active', 'failed', 'skipped',
]);

export const matchStatusEnum = pgEnum('match_status', [
  'upcoming', 'live', 'completed', 'postponed', 'cancelled', 'abandoned',
]);

export const sportTypeEnum = pgEnum('sport_type', [
  'cricket', 'football', 'tennis', 'basketball', 'baseball',
  'hockey', 'mma', 'boxing', 'f1', 'golf', 'other',
]);

export const downloadStatusEnum = pgEnum('download_status', [
  'pending', 'downloading', 'completed', 'failed', 'paused', 'cancelled',
]);

// ─── Tables ──────────────────────────────────────────────────

export const users = pgTable('users', {
  id:                uuid('id').primaryKey().defaultRandom(),
  name:              text('name').notNull(),
  email:             text('email').unique(),
  phone:             text('phone').unique(),
  passwordHash:      text('password_hash'),
  avatar:            text('avatar'),
  role:              userRoleEnum('role').default('user').notNull(),
  isActive:          boolean('is_active').default(true).notNull(),
  emailVerified:     boolean('email_verified').default(false).notNull(),
  phoneVerified:     boolean('phone_verified').default(false).notNull(),
  isPremium:         boolean('is_premium').default(false).notNull(),
  subscriptionEndsAt: timestamp('subscription_ends_at'),
  country:           text('country'),
  language:          text('language').default('en'),
  fcmToken:          text('fcm_token'),
  createdAt:         timestamp('created_at').defaultNow().notNull(),
  updatedAt:         timestamp('updated_at').defaultNow().notNull(),
  deletedAt:         timestamp('deleted_at'),
});

export const sessions = pgTable('sessions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshToken: text('refresh_token').unique().notNull(),
  deviceName:   text('device_name'),
  deviceType:   text('device_type'),
  platform:     text('platform'),
  ipAddress:    text('ip_address'),
  userAgent:    text('user_agent'),
  isActive:     boolean('is_active').default(true).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
  expiresAt:    timestamp('expires_at').notNull(),
}, (t) => [index('sessions_user_id_idx').on(t.userId)]);

export const otps = pgTable('otps', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  identifier: text('identifier').notNull(),
  code:       text('code').notNull(),
  type:       text('type').notNull(),
  expiresAt:  timestamp('expires_at').notNull(),
  usedAt:     timestamp('used_at'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  slug:        text('slug').unique().notNull(),
  description: text('description'),
  icon:        text('icon'),
  image:       text('image'),
  isActive:    boolean('is_active').default(true).notNull(),
  sortOrder:   integer('sort_order').default(0).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
  deletedAt:   timestamp('deleted_at'),
});

export const channels = pgTable('channels', {
  id:               uuid('id').primaryKey().defaultRandom(),
  name:             text('name').notNull(),
  slug:             text('slug').unique().notNull(),
  description:      text('description'),
  logo:             text('logo'),
  thumbnail:        text('thumbnail'),
  banner:           text('banner'),
  categoryId:       uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  language:         text('language'),
  country:          text('country'),
  primaryStreamUrl: text('primary_stream_url'),
  backupStreamUrl:  text('backup_stream_url'),
  thirdBackupUrl:   text('third_backup_url'),
  streamType:       streamTypeEnum('stream_type').default('HLS').notNull(),
  epgChannelId:     text('epg_channel_id'),
  streamStatus:     channelStreamStatusEnum('stream_status').default('active').notNull(),
  isActive:         boolean('is_active').default(true).notNull(),
  isFeatured:       boolean('is_featured').default(false).notNull(),
  isTrending:       boolean('is_trending').default(false).notNull(),
  isPremium:        boolean('is_premium').default(false).notNull(),
  isLive:           boolean('is_live').default(true).notNull(),
  viewCount:        integer('view_count').default(0).notNull(),
  sortOrder:        integer('sort_order').default(0).notNull(),
  tags:             text('tags').array().default([]),
  lastActiveAt:     timestamp('last_active_at'),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  updatedAt:        timestamp('updated_at').defaultNow().notNull(),
  deletedAt:        timestamp('deleted_at'),
}, (t) => [
  index('channels_is_active_idx').on(t.isActive),
  index('channels_category_id_idx').on(t.categoryId),
  index('channels_created_at_idx').on(t.createdAt),
  index('channels_last_active_at_idx').on(t.lastActiveAt),
]);

export const movies = pgTable('movies', {
  id:          uuid('id').primaryKey().defaultRandom(),
  title:       text('title').notNull(),
  slug:        text('slug').unique().notNull(),
  description: text('description'),
  poster:      text('poster'),
  banner:      text('banner'),
  trailerUrl:  text('trailer_url'),
  streamUrl:   text('stream_url'),
  categoryId:  uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  genres:      text('genres').array().default([]),
  cast:        text('cast').array().default([]),
  director:    text('director'),
  year:        integer('year'),
  duration:    integer('duration'),
  rating:      real('rating'),
  ageRating:   text('age_rating'),
  language:    text('language'),
  country:     text('country'),
  isPremium:   boolean('is_premium').default(false).notNull(),
  isFeatured:  boolean('is_featured').default(false).notNull(),
  isTrending:  boolean('is_trending').default(false).notNull(),
  isActive:    boolean('is_active').default(true).notNull(),
  viewCount:   integer('view_count').default(0).notNull(),
  sortOrder:   integer('sort_order').default(0).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
  deletedAt:   timestamp('deleted_at'),
}, (t) => [
  index('movies_is_active_idx').on(t.isActive),
  index('movies_category_id_idx').on(t.categoryId),
  index('movies_created_at_idx').on(t.createdAt),
]);

export const series = pgTable('series', {
  id:          uuid('id').primaryKey().defaultRandom(),
  title:       text('title').notNull(),
  slug:        text('slug').unique().notNull(),
  description: text('description'),
  poster:      text('poster'),
  banner:      text('banner'),
  trailerUrl:  text('trailer_url'),
  categoryId:  uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  genres:      text('genres').array().default([]),
  cast:        text('cast').array().default([]),
  director:    text('director'),
  year:        integer('year'),
  ageRating:   text('age_rating'),
  language:    text('language'),
  country:     text('country'),
  isPremium:   boolean('is_premium').default(false).notNull(),
  isFeatured:  boolean('is_featured').default(false).notNull(),
  isTrending:  boolean('is_trending').default(false).notNull(),
  isActive:    boolean('is_active').default(true).notNull(),
  viewCount:   integer('view_count').default(0).notNull(),
  sortOrder:   integer('sort_order').default(0).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
  deletedAt:   timestamp('deleted_at'),
}, (t) => [
  index('series_is_active_idx').on(t.isActive),
  index('series_category_id_idx').on(t.categoryId),
  index('series_created_at_idx').on(t.createdAt),
]);

export const seasons = pgTable('seasons', {
  id:           uuid('id').primaryKey().defaultRandom(),
  seriesId:     uuid('series_id').notNull().references(() => series.id, { onDelete: 'cascade' }),
  seasonNumber: integer('season_number').notNull(),
  title:        text('title'),
  description:  text('description'),
  poster:       text('poster'),
  year:         integer('year'),
  isActive:     boolean('is_active').default(true).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (t) => [unique().on(t.seriesId, t.seasonNumber)]);

export const episodes = pgTable('episodes', {
  id:            uuid('id').primaryKey().defaultRandom(),
  seasonId:      uuid('season_id').notNull().references(() => seasons.id, { onDelete: 'cascade' }),
  episodeNumber: integer('episode_number').notNull(),
  title:         text('title').notNull(),
  description:   text('description'),
  thumbnail:     text('thumbnail'),
  streamUrl:     text('stream_url'),
  duration:      integer('duration'),
  ageRating:     text('age_rating'),
  isPremium:     boolean('is_premium').default(false).notNull(),
  isActive:      boolean('is_active').default(true).notNull(),
  viewCount:     integer('view_count').default(0).notNull(),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
}, (t) => [unique().on(t.seasonId, t.episodeNumber)]);

export const epgPrograms = pgTable('epg_programs', {
  id:          uuid('id').primaryKey().defaultRandom(),
  channelId:   uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  title:       text('title').notNull(),
  description: text('description'),
  startTime:   timestamp('start_time').notNull(),
  endTime:     timestamp('end_time').notNull(),
  category:    text('category'),
  poster:      text('poster'),
  rating:      text('rating'),
  isLive:      boolean('is_live').default(false).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptionPlans = pgTable('subscription_plans', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         text('name').notNull(),
  slug:         text('slug').unique().notNull(),
  description:  text('description'),
  price:        real('price').notNull(),
  currency:     text('currency').default('USD').notNull(),
  durationDays: integer('duration_days').notNull(),
  features:     text('features').array().default([]),
  isActive:     boolean('is_active').default(true).notNull(),
  isFeatured:   boolean('is_featured').default(false).notNull(),
  trialDays:    integer('trial_days').default(0).notNull(),
  sortOrder:    integer('sort_order').default(0).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').unique().notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId:         uuid('plan_id').notNull().references(() => subscriptionPlans.id, { onDelete: 'restrict' }),
  status:         subscriptionStatusEnum('status').default('active').notNull(),
  startedAt:      timestamp('started_at').defaultNow().notNull(),
  endsAt:         timestamp('ends_at').notNull(),
  trialEndsAt:    timestamp('trial_ends_at'),
  renewedAt:      timestamp('renewed_at'),
  nextRenewalAt:  timestamp('next_renewal_at'),
  cancelledAt:    timestamp('cancelled_at'),
  couponCode:     text('coupon_code'),
  discount:       real('discount'),
  autoRenew:      boolean('auto_renew').default(true).notNull(),
  gracePeriodDays: integer('grace_period_days').default(3).notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('subscriptions_status_idx').on(t.status),
  index('subscriptions_ends_at_idx').on(t.endsAt),
]);

export const payments = pgTable('payments', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
  gateway:        text('gateway').notNull(),
  gatewayTxId:    text('gateway_tx_id'),
  amount:         real('amount').notNull(),
  currency:       text('currency').default('USD').notNull(),
  status:         paymentStatusEnum('status').default('pending').notNull(),
  invoiceNumber:  text('invoice_number').unique(),
  refundReason:   text('refund_reason'),
  webhookPayload: json('webhook_payload'),
  metadata:       json('metadata'),
  paidAt:         timestamp('paid_at'),
  refundedAt:     timestamp('refunded_at'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('payments_user_id_idx').on(t.userId),
  index('payments_status_idx').on(t.status),
  index('payments_subscription_id_idx').on(t.subscriptionId),
]);

export const notifications = pgTable('notifications', {
  id:          uuid('id').primaryKey().defaultRandom(),
  title:       text('title').notNull(),
  body:        text('body').notNull(),
  type:        notificationTypeEnum('type').default('push').notNull(),
  targetAll:   boolean('target_all').default(false).notNull(),
  targetRoles: text('target_roles').array().default([]),
  targetUsers: uuid('target_users').array().default([]),
  country:     text('country'),
  language:    text('language'),
  isPremium:   boolean('is_premium'),
  imageUrl:    text('image_url'),
  deepLink:    text('deep_link'),
  scheduledAt: timestamp('scheduled_at'),
  sentAt:      timestamp('sent_at'),
  isActive:    boolean('is_active').default(true).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

export const notificationReads = pgTable('notification_reads', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  notificationId: uuid('notification_id').notNull().references(() => notifications.id, { onDelete: 'cascade' }),
  readAt:         timestamp('read_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.userId, t.notificationId),
  index('notification_reads_user_id_idx').on(t.userId),
]);

export const announcements = pgTable('announcements', {
  id:            uuid('id').primaryKey().defaultRandom(),
  title:         text('title').notNull(),
  message:       text('message').notNull(),
  type:          text('type').default('banner').notNull(),
  priority:      integer('priority').default(0).notNull(),
  imageUrl:      text('image_url'),
  deepLink:      text('deep_link'),
  isDismissible: boolean('is_dismissible').default(true).notNull(),
  targetAll:     boolean('target_all').default(true).notNull(),
  country:       text('country'),
  language:      text('language'),
  isPremium:     boolean('is_premium'),
  startsAt:      timestamp('starts_at'),
  expiresAt:     timestamp('expires_at'),
  isActive:      boolean('is_active').default(true).notNull(),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
});

export const adProviders = pgTable('ad_providers', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  name:               text('name').notNull(),
  slug:               text('slug').unique().notNull(),
  apiKey:             text('api_key'),
  appId:              text('app_id'),
  adUnitBanner:       text('ad_unit_banner'),
  adUnitInterstitial: text('ad_unit_interstitial'),
  adUnitRewarded:     text('ad_unit_rewarded'),
  adUnitNative:       text('ad_unit_native'),
  adUnitAppOpen:      text('ad_unit_app_open'),
  isActive:           boolean('is_active').default(true).notNull(),
  isSelected:         boolean('is_selected').default(false).notNull(),
  isTestMode:         boolean('is_test_mode').default(true).notNull(),
  config:             json('config'),
  createdAt:          timestamp('created_at').defaultNow().notNull(),
  updatedAt:          timestamp('updated_at').defaultNow().notNull(),
});

export const advertisements = pgTable('advertisements', {
  id:         uuid('id').primaryKey().defaultRandom(),
  title:      text('title').notNull(),
  type:       adTypeEnum('type').default('banner').notNull(),
  imageUrl:   text('image_url'),
  videoUrl:   text('video_url'),
  targetUrl:  text('target_url'),
  duration:   integer('duration'),
  providerId: uuid('provider_id').references(() => adProviders.id),
  country:    text('country'),
  language:   text('language'),
  isPremium:  boolean('is_premium').default(false).notNull(),
  isActive:   boolean('is_active').default(true).notNull(),
  startDate:  timestamp('start_date'),
  endDate:    timestamp('end_date'),
  impressions: integer('impressions').default(0).notNull(),
  clicks:     integer('clicks').default(0).notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
  updatedAt:  timestamp('updated_at').defaultNow().notNull(),
});

export const adSettings = pgTable('ad_settings', {
  id:                         uuid('id').primaryKey().defaultRandom(),
  key:                        text('key').unique().notNull(),
  activeProviderId:           uuid('active_provider_id'),
  maxAdsPerSession:           integer('max_ads_per_session').default(5).notNull(),
  maxAdsPerDay:               integer('max_ads_per_day').default(20).notNull(),
  cooldownSeconds:            integer('cooldown_seconds').default(30).notNull(),
  minIntervalSeconds:         integer('min_interval_seconds').default(60).notNull(),
  interstitialEveryNScreens:  integer('interstitial_every_n_screens').default(3).notNull(),
  interstitialEveryNMinutes:  integer('interstitial_every_n_minutes').default(5).notNull(),
  rewardedCooldownSeconds:    integer('rewarded_cooldown_seconds').default(120).notNull(),
  frequencyCap:               integer('frequency_cap').default(10).notNull(),
  isEnabled:                  boolean('is_enabled').default(true).notNull(),
  forceUpdate:                boolean('force_update').default(false).notNull(),
  maintenanceMode:            boolean('maintenance_mode').default(false).notNull(),
  maintenanceMessage:         text('maintenance_message'),
  createdAt:                  timestamp('created_at').defaultNow().notNull(),
  updatedAt:                  timestamp('updated_at').defaultNow().notNull(),
});

export const adPlacements = pgTable('ad_placements', {
  id:              uuid('id').primaryKey().defaultRandom(),
  name:            text('name').notNull(),
  slug:            text('slug').unique().notNull(),
  type:            adTypeEnum('type').notNull(),
  screen:          text('screen').notNull(),
  isEnabled:       boolean('is_enabled').default(true).notNull(),
  frequency:       integer('frequency').default(1).notNull(),
  cooldownSeconds: integer('cooldown_seconds').default(0).notNull(),
  skipAfterSeconds: integer('skip_after_seconds'),
  description:     text('description'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
});

export const adEvents = pgTable('ad_events', {
  id:         uuid('id').primaryKey().defaultRandom(),
  eventType:  adEventTypeEnum('event_type').notNull(),
  providerId: uuid('provider_id').references(() => adProviders.id),
  adId:       uuid('ad_id'),
  placement:  text('placement'),
  country:    text('country'),
  device:     text('device'),
  os:         text('os'),
  revenue:    real('revenue'),
  errorCode:  text('error_code'),
  errorMsg:   text('error_msg'),
  sessionId:  text('session_id'),
  userId:     uuid('user_id'),
  metadata:   json('metadata'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
});

export const adRevenue = pgTable('ad_revenue', {
  id:          uuid('id').primaryKey().defaultRandom(),
  date:        date('date').notNull(),
  providerId:  uuid('provider_id'),
  placement:   text('placement'),
  country:     text('country'),
  device:      text('device'),
  os:          text('os'),
  impressions: integer('impressions').default(0).notNull(),
  clicks:      integer('clicks').default(0).notNull(),
  revenue:     real('revenue').default(0).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => [unique().on(t.date, t.providerId, t.placement, t.country, t.device, t.os)]);

export const coupons = pgTable('coupons', {
  id:            uuid('id').primaryKey().defaultRandom(),
  code:          text('code').unique().notNull(),
  discountType:  couponDiscountTypeEnum('discount_type').notNull(),
  discountValue: real('discount_value').notNull(),
  minPurchase:   real('min_purchase'),
  maxUses:       integer('max_uses'),
  usedCount:     integer('used_count').default(0).notNull(),
  perUserLimit:  integer('per_user_limit').default(1).notNull(),
  isActive:      boolean('is_active').default(true).notNull(),
  expiresAt:     timestamp('expires_at'),
  planIds:       uuid('plan_ids').array().default([]),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
  updatedAt:     timestamp('updated_at').defaultNow().notNull(),
});

export const couponUsage = pgTable('coupon_usage', {
  id:        uuid('id').primaryKey().defaultRandom(),
  couponId:  uuid('coupon_id').notNull().references(() => coupons.id),
  userId:    uuid('user_id').notNull(),
  usedAt:    timestamp('used_at').defaultNow().notNull(),
  discount:  real('discount').notNull(),
  planId:    uuid('plan_id'),
});

export const subscriptionHistory = pgTable('subscription_history', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         uuid('user_id').notNull(),
  subscriptionId: uuid('subscription_id'),
  planId:         uuid('plan_id'),
  fromStatus:     subscriptionStatusEnum('from_status'),
  toStatus:       subscriptionStatusEnum('to_status').notNull(),
  reason:         text('reason'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
});

export const paymentGateways = pgTable('payment_gateways', {
  id:             uuid('id').primaryKey().defaultRandom(),
  name:           text('name').notNull(),
  slug:           text('slug').unique().notNull(),
  isActive:       boolean('is_active').default(true).notNull(),
  isTestMode:     boolean('is_test_mode').default(true).notNull(),
  publicKey:      text('public_key'),
  secretKey:      text('secret_key'),
  webhookSecret:  text('webhook_secret'),
  config:         json('config'),
  feePercent:     real('fee_percent').default(0).notNull(),
  fixedFee:       real('fixed_fee').default(0).notNull(),
  currencies:     text('currencies').array().default([]),
  countries:      text('countries').array().default([]),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
});

export const favorites = pgTable('favorites', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'cascade' }),
  movieId:   uuid('movie_id').references(() => movies.id, { onDelete: 'cascade' }),
  seriesId:  uuid('series_id').references(() => series.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('favorites_user_id_idx').on(t.userId)]);

export const watchHistory = pgTable('watch_history', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  movieId:   uuid('movie_id').references(() => movies.id, { onDelete: 'cascade' }),
  seriesId:  uuid('series_id').references(() => series.id, { onDelete: 'cascade' }),
  episodeId: uuid('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  position:  integer('position').default(0).notNull(),
  duration:  integer('duration'),
  completed: boolean('completed').default(false).notNull(),
  watchedAt: timestamp('watched_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [index('watch_history_user_id_idx').on(t.userId)]);

export const searchHistory = pgTable('search_history', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  query:     text('query').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('search_history_user_id_idx').on(t.userId)]);

export const auditLogs = pgTable('audit_logs', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').references(() => users.id),
  action:     text('action').notNull(),
  resource:   text('resource').notNull(),
  resourceId: text('resource_id'),
  oldValues:  json('old_values'),
  newValues:  json('new_values'),
  ipAddress:  text('ip_address'),
  userAgent:  text('user_agent'),
  level:      auditLevelEnum('level').default('info').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('audit_logs_user_id_idx').on(t.userId),
  index('audit_logs_action_idx').on(t.action),
]);

export const settings = pgTable('settings', {
  id:          uuid('id').primaryKey().defaultRandom(),
  key:         text('key').unique().notNull(),
  value:       json('value').notNull(),
  description: text('description'),
  isPublic:    boolean('is_public').default(false).notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

export const featureFlags = pgTable('feature_flags', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').unique().notNull(),
  isEnabled:   boolean('is_enabled').default(false).notNull(),
  description: text('description'),
  roles:       text('roles').array().default([]),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

export const geoRestrictions = pgTable('geo_restrictions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  countryCode: text('country_code').unique().notNull(),
  isBlocked:   boolean('is_blocked').default(true).notNull(),
  reason:      text('reason'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

export const parentalSettings = pgTable('parental_settings', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  userId:               uuid('user_id').unique().notNull().references(() => users.id, { onDelete: 'cascade' }),
  pin:                  text('pin'),
  maxAgeRating:         text('max_age_rating'),
  restrictedCategories: uuid('restricted_categories').array().default([]),
  isEnabled:            boolean('is_enabled').default(false).notNull(),
  createdAt:            timestamp('created_at').defaultNow().notNull(),
  updatedAt:            timestamp('updated_at').defaultNow().notNull(),
});

export const roles = pgTable('roles', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').unique().notNull(),
  description: text('description'),
  permissions: text('permissions').array().default([]),
  isSystem:    boolean('is_system').default(false).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

export const banners = pgTable('banners', {
  id:        uuid('id').primaryKey().defaultRandom(),
  title:     text('title').notNull(),
  imageUrl:  text('image_url'),
  link:      text('link'),
  position:  text('position').default('home_hero').notNull(),
  isActive:  boolean('is_active').default(false).notNull(),
  priority:  integer('priority').default(0).notNull(),
  startsAt:  timestamp('starts_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const supportTickets = pgTable('support_tickets', {
  id:          uuid('id').primaryKey().defaultRandom(),
  ticketNo:    text('ticket_no').unique().notNull(),
  userEmail:   text('user_email').notNull(),
  subject:     text('subject').notNull(),
  description: text('description'),
  priority:    text('priority').default('Medium').notNull(),
  status:      text('status').default('Open').notNull(),
  assignedTo:  text('assigned_to'),
  resolvedAt:  timestamp('resolved_at'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

export const sports = pgTable('sports', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').unique().notNull(),
  slug:      text('slug').unique().notNull(),
  icon:      text('icon'),
  isActive:  boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (t) => [index('sports_is_active_idx').on(t.isActive)]);

export const tournaments = pgTable('tournaments', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  slug:        text('slug').unique().notNull(),
  description: text('description'),
  logo:        text('logo'),
  banner:      text('banner'),
  country:     text('country'),
  sportId:     uuid('sport_id').notNull().references(() => sports.id, { onDelete: 'cascade' }),
  startDate:   timestamp('start_date'),
  endDate:     timestamp('end_date'),
  isActive:    boolean('is_active').default(true).notNull(),
  sortOrder:   integer('sort_order').default(0).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
  deletedAt:   timestamp('deleted_at'),
}, (t) => [
  index('tournaments_sport_id_idx').on(t.sportId),
  index('tournaments_is_active_idx').on(t.isActive),
]);

export const sportTeams = pgTable('sport_teams', {
  id:             uuid('id').primaryKey().defaultRandom(),
  name:           text('name').notNull(),
  slug:           text('slug').unique().notNull(),
  shortName:      text('short_name'),
  abbr:           text('abbr'),
  logo:           text('logo'),
  country:        text('country'),
  primaryColor:   text('primary_color'),
  secondaryColor: text('secondary_color'),
  tournamentId:   uuid('tournament_id').references(() => tournaments.id, { onDelete: 'set null' }),
  isActive:       boolean('is_active').default(true).notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
  deletedAt:      timestamp('deleted_at'),
}, (t) => [
  index('sport_teams_tournament_id_idx').on(t.tournamentId),
  index('sport_teams_is_active_idx').on(t.isActive),
]);

export const matches = pgTable('matches', {
  id:           uuid('id').primaryKey().defaultRandom(),
  title:        text('title'),
  sportId:      uuid('sport_id').notNull().references(() => sports.id, { onDelete: 'cascade' }),
  tournamentId: uuid('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  teamAId:      uuid('team_a_id').notNull().references(() => sportTeams.id, { onDelete: 'cascade' }),
  teamBId:      uuid('team_b_id').notNull().references(() => sportTeams.id, { onDelete: 'cascade' }),
  scheduledAt:  timestamp('scheduled_at').notNull(),
  status:       matchStatusEnum('status').default('upcoming').notNull(),
  venue:        text('venue'),
  streamUrl:    text('stream_url'),
  liveUrl:      text('live_url'),
  teamAScore:   text('team_a_score'),
  teamBScore:   text('team_b_score'),
  winnerId:     uuid('winner_id').references(() => sportTeams.id, { onDelete: 'set null' }),
  description:  text('description'),
  isActive:     boolean('is_active').default(true).notNull(),
  viewCount:    integer('view_count').default(0).notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
  deletedAt:    timestamp('deleted_at'),
}, (t) => [
  index('matches_sport_id_idx').on(t.sportId),
  index('matches_tournament_id_idx').on(t.tournamentId),
  index('matches_status_idx').on(t.status),
  index('matches_scheduled_at_idx').on(t.scheduledAt),
  index('matches_team_a_id_idx').on(t.teamAId),
  index('matches_team_b_id_idx').on(t.teamBId),
]);

export const matchCommentary = pgTable('match_commentary', {
  id:        uuid('id').primaryKey().defaultRandom(),
  matchId:   uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  eventType: text('event_type').default('general').notNull(),
  text:      text('text').notNull(),
  score:     text('score'),
  over:      text('over'),
  minute:    integer('minute'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [index('match_commentary_match_id_ts_idx').on(t.matchId, t.timestamp)]);

export const matchAlerts = pgTable('match_alerts', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  matchId:   uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.userId, t.matchId),
  index('match_alerts_user_id_idx').on(t.userId),
  index('match_alerts_match_id_idx').on(t.matchId),
]);

export const userFavoriteTeams = pgTable('user_favorite_teams', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId:    uuid('team_id').notNull().references(() => sportTeams.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  unique().on(t.userId, t.teamId),
  index('user_favorite_teams_user_id_idx').on(t.userId),
]);

export const downloads = pgTable('downloads', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contentType: text('content_type').default('movie').notNull(),
  contentId:   text('content_id').notNull(),
  title:       text('title').notNull(),
  poster:      text('poster'),
  streamUrl:   text('stream_url').notNull(),
  quality:     text('quality').default('720p').notNull(),
  fileSize:    integer('file_size').default(0).notNull(),
  progress:    real('progress').default(0).notNull(),
  status:      downloadStatusEnum('status').default('pending').notNull(),
  filePath:    text('file_path'),
  expiresAt:   timestamp('expires_at'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('downloads_user_id_idx').on(t.userId),
  index('downloads_status_idx').on(t.status),
]);

export const reviews = pgTable('reviews', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contentType: text('content_type').notNull(),
  contentId:   text('content_id').notNull(),
  rating:      integer('rating').notNull(),
  title:       text('title'),
  comment:     text('comment'),
  isApproved:  boolean('is_approved').default(true).notNull(),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('reviews_content_idx').on(t.contentType, t.contentId),
  index('reviews_user_id_idx').on(t.userId),
  index('reviews_rating_idx').on(t.rating),
]);

export const importJobs = pgTable('import_jobs', {
  id:              uuid('id').primaryKey().defaultRandom(),
  filename:        text('filename').notNull(),
  filePath:        text('file_path').notNull(),
  fileSize:        integer('file_size').notNull(),
  status:          importJobStatusEnum('status').default('pending').notNull(),
  totalChannels:   integer('total_channels').default(0).notNull(),
  checkedChannels: integer('checked_channels').default(0).notNull(),
  activeChannels:  integer('active_channels').default(0).notNull(),
  failedChannels:  integer('failed_channels').default(0).notNull(),
  skippedChannels: integer('skipped_channels').default(0).notNull(),
  batchSize:       integer('batch_size').default(50).notNull(),
  saveFailed:      boolean('save_failed').default(false).notNull(),
  startedAt:       timestamp('started_at'),
  completedAt:     timestamp('completed_at'),
  errorMessage:    text('error_message'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
  updatedAt:       timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('import_jobs_status_idx').on(t.status),
  index('import_jobs_created_at_idx').on(t.createdAt),
]);

export const importChannels = pgTable('import_channels', {
  id:             uuid('id').primaryKey().defaultRandom(),
  importJobId:    uuid('import_job_id').notNull().references(() => importJobs.id, { onDelete: 'cascade' }),
  channelName:    text('channel_name').notNull(),
  streamUrl:      text('stream_url').notNull(),
  logoUrl:        text('logo_url'),
  groupCategory:  text('group_category'),
  status:         importChannelStatusEnum('status').default('pending').notNull(),
  failReason:     text('fail_reason'),
  httpStatus:     integer('http_status'),
  responseTimeMs: integer('response_time_ms'),
  retryCount:     integer('retry_count').default(0).notNull(),
  channelId:      uuid('channel_id'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('import_channels_job_id_idx').on(t.importJobId),
  index('import_channels_status_idx').on(t.status),
  index('import_channels_channel_name_idx').on(t.channelName),
]);

export const deletedChannelLogs = pgTable('deleted_channel_logs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  channelName:  text('channel_name').notNull(),
  streamUrl:    text('stream_url'),
  logo:         text('logo'),
  categoryName: text('category_name'),
  deleteReason: text('delete_reason').notNull(),
  deletedAt:    timestamp('deleted_at').defaultNow().notNull(),
}, (t) => [
  index('deleted_channel_logs_deleted_at_idx').on(t.deletedAt),
]);
