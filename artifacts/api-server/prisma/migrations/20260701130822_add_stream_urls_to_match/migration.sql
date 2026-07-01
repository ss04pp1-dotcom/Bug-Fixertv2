-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('super_admin', 'admin', 'moderator', 'editor', 'support', 'user');

-- CreateEnum
CREATE TYPE "stream_type" AS ENUM ('HLS', 'M3U', 'RTMP', 'DASH');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('inactive', 'active', 'expired', 'cancelled', 'trial', 'pending', 'refunded');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('push', 'in_app', 'email', 'sms');

-- CreateEnum
CREATE TYPE "ad_type" AS ENUM ('banner', 'video', 'popup', 'interstitial', 'rewarded', 'native', 'app_open', 'splash');

-- CreateEnum
CREATE TYPE "ad_event_type" AS ENUM ('impression', 'click', 'error', 'session', 'revenue');

-- CreateEnum
CREATE TYPE "coupon_discount_type" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "audit_level" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "channel_stream_status" AS ENUM ('pending', 'checking', 'active', 'offline', 'failed');

-- CreateEnum
CREATE TYPE "health_override" AS ENUM ('AUTO', 'FORCE_HEALTHY', 'FORCE_OFFLINE');

-- CreateEnum
CREATE TYPE "health_check_mode" AS ENUM ('SERVER', 'USER_PLAYBACK', 'DISABLED');

-- CreateEnum
CREATE TYPE "server_source_type" AS ENUM ('ADMIN', 'GITHUB');

-- CreateEnum
CREATE TYPE "github_sync_status" AS ENUM ('pending', 'running', 'success', 'failed');

-- CreateEnum
CREATE TYPE "import_job_status" AS ENUM ('pending', 'parsing', 'validating', 'completing', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "import_channel_status" AS ENUM ('pending', 'checking', 'active', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('upcoming', 'live', 'completed', 'postponed', 'cancelled', 'abandoned');

-- CreateEnum
CREATE TYPE "sport_type" AS ENUM ('cricket', 'football', 'tennis', 'basketball', 'baseball', 'hockey', 'mma', 'boxing', 'f1', 'golf', 'other');

-- CreateEnum
CREATE TYPE "download_status" AS ENUM ('pending', 'downloading', 'completed', 'failed', 'paused', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT,
    "avatar" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'user',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "subscription_ends_at" TIMESTAMP(3),
    "country" TEXT,
    "language" TEXT DEFAULT 'en',
    "fcm_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "device_name" TEXT,
    "device_type" TEXT,
    "platform" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "identifier" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "image" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "thumbnail" TEXT,
    "banner" TEXT,
    "category_id" UUID,
    "language" TEXT,
    "country" TEXT,
    "primary_stream_url" TEXT,
    "backup_stream_url" TEXT,
    "third_backup_url" TEXT,
    "stream_type" "stream_type" NOT NULL DEFAULT 'HLS',
    "epg_channel_id" TEXT,
    "stream_status" "channel_stream_status" NOT NULL DEFAULT 'active',
    "health_override" "health_override" NOT NULL DEFAULT 'AUTO',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_trending" BOOLEAN NOT NULL DEFAULT false,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "is_live" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "last_active_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "normalized_name" TEXT,
    "github_channel_id" TEXT,
    "admin_name_override" TEXT,
    "admin_logo_override" TEXT,
    "admin_category_id_override" UUID,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_sources" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_interval_minutes" INTEGER NOT NULL DEFAULT 10,
    "etag" TEXT,
    "last_modified" TEXT,
    "last_fetched_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "last_successful_sync_at" TIMESTAMP(3),
    "last_sync_status" "github_sync_status",
    "last_sync_message" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "is_syncing" BOOLEAN NOT NULL DEFAULT false,
    "sync_started_at" TIMESTAMP(3),
    "channel_count" INTEGER NOT NULL DEFAULT 0,
    "server_count" INTEGER NOT NULL DEFAULT 0,
    "cookie" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,
    "origin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_servers" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "link" TEXT NOT NULL,
    "cookie" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,
    "origin" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "source_type" "server_source_type" NOT NULL DEFAULT 'ADMIN',
    "github_source_id" UUID,
    "github_channel_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "health_check_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "created_by_sync" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_sync_logs" (
    "id" UUID NOT NULL,
    "github_source_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "status" "github_sync_status" NOT NULL,
    "added" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "total_parsed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_merge_logs" (
    "id" UUID NOT NULL,
    "trigger" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "kept_channel_id" TEXT NOT NULL,
    "merged_channel_ids" TEXT[],
    "servers_moved" INTEGER NOT NULL DEFAULT 0,
    "servers_deduplicated" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_merge_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playback_events" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "user_id" UUID,
    "success" BOOLEAN NOT NULL,
    "duration" INTEGER,
    "app_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playback_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deleted_channel_logs" (
    "id" UUID NOT NULL,
    "channel_name" TEXT NOT NULL,
    "stream_url" TEXT,
    "logo" TEXT,
    "category_name" TEXT,
    "delete_reason" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_channel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movies" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "poster" TEXT,
    "banner" TEXT,
    "trailer_url" TEXT,
    "stream_url" TEXT,
    "backup_stream_url" TEXT,
    "cookie" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,
    "origin" TEXT,
    "category_id" UUID,
    "genres" TEXT[],
    "cast" TEXT[],
    "director" TEXT,
    "year" INTEGER,
    "duration" INTEGER,
    "rating" DOUBLE PRECISION,
    "age_rating" TEXT,
    "language" TEXT,
    "country" TEXT,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_trending" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "series" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "poster" TEXT,
    "banner" TEXT,
    "trailer_url" TEXT,
    "category_id" UUID,
    "genres" TEXT[],
    "cast" TEXT[],
    "director" TEXT,
    "year" INTEGER,
    "age_rating" TEXT,
    "language" TEXT,
    "country" TEXT,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_trending" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "series_id" UUID NOT NULL,
    "season_number" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "poster" TEXT,
    "year" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "thumbnail" TEXT,
    "stream_url" TEXT,
    "backup_stream_url" TEXT,
    "cookie" TEXT,
    "user_agent" TEXT,
    "referer" TEXT,
    "origin" TEXT,
    "duration" INTEGER,
    "age_rating" TEXT,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epg_programs" (
    "id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "poster" TEXT,
    "rating" TEXT,
    "is_live" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epg_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "duration_days" INTEGER NOT NULL,
    "features" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "trial_days" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "renewed_at" TIMESTAMP(3),
    "next_renewal_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "coupon_code" TEXT,
    "discount" DOUBLE PRECISION,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "grace_period_days" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_id" UUID,
    "gateway" TEXT NOT NULL,
    "gateway_tx_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "invoice_number" TEXT,
    "refund_reason" TEXT,
    "webhook_payload" JSONB,
    "metadata" JSONB,
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "notification_type" NOT NULL DEFAULT 'push',
    "target_all" BOOLEAN NOT NULL DEFAULT false,
    "target_roles" TEXT[],
    "target_users" UUID[],
    "country" TEXT,
    "language" TEXT,
    "is_premium" BOOLEAN,
    "image_url" TEXT,
    "deep_link" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_reads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'banner',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "image_url" TEXT,
    "deep_link" TEXT,
    "is_dismissible" BOOLEAN NOT NULL DEFAULT true,
    "target_all" BOOLEAN NOT NULL DEFAULT true,
    "country" TEXT,
    "language" TEXT,
    "is_premium" BOOLEAN,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ad_type" NOT NULL DEFAULT 'banner',
    "image_url" TEXT,
    "video_url" TEXT,
    "target_url" TEXT,
    "duration" INTEGER,
    "provider_id" UUID,
    "country" TEXT,
    "language" TEXT,
    "is_premium" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_providers" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "api_key" TEXT,
    "app_id" TEXT,
    "ad_unit_banner" TEXT,
    "ad_unit_interstitial" TEXT,
    "ad_unit_rewarded" TEXT,
    "ad_unit_native" TEXT,
    "ad_unit_app_open" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "is_test_mode" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "active_provider_id" UUID,
    "max_ads_per_session" INTEGER NOT NULL DEFAULT 5,
    "max_ads_per_day" INTEGER NOT NULL DEFAULT 20,
    "cooldown_seconds" INTEGER NOT NULL DEFAULT 30,
    "min_interval_seconds" INTEGER NOT NULL DEFAULT 60,
    "interstitial_every_n_screens" INTEGER NOT NULL DEFAULT 3,
    "interstitial_every_n_minutes" INTEGER NOT NULL DEFAULT 5,
    "rewarded_cooldown_seconds" INTEGER NOT NULL DEFAULT 120,
    "frequency_cap" INTEGER NOT NULL DEFAULT 10,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "force_update" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_placements" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ad_type" NOT NULL,
    "screen" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "cooldown_seconds" INTEGER NOT NULL DEFAULT 0,
    "skip_after_seconds" INTEGER,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_events" (
    "id" UUID NOT NULL,
    "event_type" "ad_event_type" NOT NULL,
    "provider_id" UUID,
    "ad_id" UUID,
    "placement" TEXT,
    "country" TEXT,
    "device" TEXT,
    "os" TEXT,
    "revenue" DOUBLE PRECISION,
    "error_code" TEXT,
    "error_msg" TEXT,
    "session_id" TEXT,
    "user_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_revenue" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "provider_id" UUID,
    "placement" TEXT,
    "country" TEXT,
    "device" TEXT,
    "os" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_revenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "discount_type" "coupon_discount_type" NOT NULL,
    "discount_value" DOUBLE PRECISION NOT NULL,
    "min_purchase" DOUBLE PRECISION,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "per_user_limit" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "plan_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usage" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discount" DOUBLE PRECISION NOT NULL,
    "plan_id" UUID,

    CONSTRAINT "coupon_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "subscription_id" UUID,
    "plan_id" UUID,
    "from_status" "subscription_status",
    "to_status" "subscription_status" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_gateways" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_test_mode" BOOLEAN NOT NULL DEFAULT true,
    "public_key" TEXT,
    "secret_key" TEXT,
    "webhook_secret" TEXT,
    "config" JSONB,
    "fee_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixed_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currencies" TEXT[],
    "countries" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_gateways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel_id" UUID,
    "movie_id" UUID,
    "series_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watch_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "movie_id" UUID,
    "series_id" UUID,
    "episode_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "watched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "level" "audit_level" NOT NULL DEFAULT 'info',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "roles" TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_restrictions" (
    "id" UUID NOT NULL,
    "country_code" TEXT NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geo_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parental_settings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pin" TEXT,
    "max_age_rating" TEXT,
    "restricted_categories" UUID[],
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parental_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "image_url" TEXT,
    "link" TEXT,
    "position" TEXT NOT NULL DEFAULT 'home_hero',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "ticket_no" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "assigned_to" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "banner" TEXT,
    "country" TEXT,
    "sport_id" UUID NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sport_teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_name" TEXT,
    "abbr" TEXT,
    "logo" TEXT,
    "country" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "tournament_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sport_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "title" TEXT,
    "sport_id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "team_a_id" UUID NOT NULL,
    "team_b_id" UUID NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'upcoming',
    "venue" TEXT,
    "stream_url" TEXT,
    "live_url" TEXT,
    "stream_urls" JSONB,
    "team_a_score" TEXT,
    "team_b_score" TEXT,
    "winner_id" UUID,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_commentary" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL DEFAULT 'general',
    "text" TEXT NOT NULL,
    "score" TEXT,
    "over" TEXT,
    "minute" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_commentary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorite_teams" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downloads" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'movie',
    "content_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "poster" TEXT,
    "stream_url" TEXT NOT NULL,
    "quality" TEXT NOT NULL DEFAULT '720p',
    "file_size" INTEGER NOT NULL DEFAULT 0,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "download_status" NOT NULL DEFAULT 'pending',
    "file_path" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "downloads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content_type" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "status" "import_job_status" NOT NULL DEFAULT 'pending',
    "total_channels" INTEGER NOT NULL DEFAULT 0,
    "checked_channels" INTEGER NOT NULL DEFAULT 0,
    "active_channels" INTEGER NOT NULL DEFAULT 0,
    "failed_channels" INTEGER NOT NULL DEFAULT 0,
    "skipped_channels" INTEGER NOT NULL DEFAULT 0,
    "batch_size" INTEGER NOT NULL DEFAULT 50,
    "save_failed" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_channels" (
    "id" UUID NOT NULL,
    "import_job_id" UUID NOT NULL,
    "channel_name" TEXT NOT NULL,
    "stream_url" TEXT NOT NULL,
    "logo_url" TEXT,
    "group_category" TEXT,
    "status" "import_channel_status" NOT NULL DEFAULT 'pending',
    "fail_reason" TEXT,
    "http_status" INTEGER,
    "response_time_ms" INTEGER,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "channel_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_key" ON "sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "otps_identifier_expires_at_idx" ON "otps"("identifier", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "channels_slug_key" ON "channels"("slug");

-- CreateIndex
CREATE INDEX "channels_is_active_idx" ON "channels"("is_active");

-- CreateIndex
CREATE INDEX "channels_category_id_idx" ON "channels"("category_id");

-- CreateIndex
CREATE INDEX "channels_created_at_idx" ON "channels"("created_at");

-- CreateIndex
CREATE INDEX "channels_last_active_at_idx" ON "channels"("last_active_at");

-- CreateIndex
CREATE INDEX "channels_name_idx" ON "channels"("name");

-- CreateIndex
CREATE INDEX "channels_primary_stream_url_idx" ON "channels"("primary_stream_url");

-- CreateIndex
CREATE UNIQUE INDEX "channels_normalized_name_key" ON "channels"("normalized_name");

-- CreateIndex
CREATE INDEX "github_sources_enabled_idx" ON "github_sources"("enabled");

-- CreateIndex
CREATE INDEX "channel_servers_channel_id_idx" ON "channel_servers"("channel_id");

-- CreateIndex
CREATE INDEX "channel_servers_github_source_id_idx" ON "channel_servers"("github_source_id");

-- CreateIndex
CREATE INDEX "channel_servers_source_type_idx" ON "channel_servers"("source_type");

-- CreateIndex
CREATE INDEX "channel_servers_deleted_at_idx" ON "channel_servers"("deleted_at");

-- CreateIndex
CREATE INDEX "github_sync_logs_github_source_id_idx" ON "github_sync_logs"("github_source_id");

-- CreateIndex
CREATE INDEX "github_sync_logs_created_at_idx" ON "github_sync_logs"("created_at");

-- CreateIndex
CREATE INDEX "channel_merge_logs_created_at_idx" ON "channel_merge_logs"("created_at");

-- CreateIndex
CREATE INDEX "channel_merge_logs_kept_channel_id_idx" ON "channel_merge_logs"("kept_channel_id");

-- CreateIndex
CREATE INDEX "playback_events_channel_id_idx" ON "playback_events"("channel_id");

-- CreateIndex
CREATE INDEX "playback_events_created_at_idx" ON "playback_events"("created_at");

-- CreateIndex
CREATE INDEX "deleted_channel_logs_deleted_at_idx" ON "deleted_channel_logs"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "movies_slug_key" ON "movies"("slug");

-- CreateIndex
CREATE INDEX "movies_is_active_idx" ON "movies"("is_active");

-- CreateIndex
CREATE INDEX "movies_category_id_idx" ON "movies"("category_id");

-- CreateIndex
CREATE INDEX "movies_created_at_idx" ON "movies"("created_at");

-- CreateIndex
CREATE INDEX "movies_title_idx" ON "movies"("title");

-- CreateIndex
CREATE UNIQUE INDEX "series_slug_key" ON "series"("slug");

-- CreateIndex
CREATE INDEX "series_is_active_idx" ON "series"("is_active");

-- CreateIndex
CREATE INDEX "series_category_id_idx" ON "series"("category_id");

-- CreateIndex
CREATE INDEX "series_created_at_idx" ON "series"("created_at");

-- CreateIndex
CREATE INDEX "series_title_idx" ON "series"("title");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_series_id_season_number_key" ON "seasons"("series_id", "season_number");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_season_id_episode_number_key" ON "episodes"("season_id", "episode_number");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_ends_at_idx" ON "subscriptions"("ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_invoice_number_key" ON "payments"("invoice_number");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_subscription_id_idx" ON "payments"("subscription_id");

-- CreateIndex
CREATE INDEX "notification_reads_user_id_idx" ON "notification_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_reads_user_id_notification_id_key" ON "notification_reads"("user_id", "notification_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_providers_slug_key" ON "ad_providers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ad_settings_key_key" ON "ad_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ad_placements_slug_key" ON "ad_placements"("slug");

-- CreateIndex
CREATE INDEX "ad_events_created_at_idx" ON "ad_events"("created_at");

-- CreateIndex
CREATE INDEX "ad_events_event_type_created_at_idx" ON "ad_events"("event_type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ad_revenue_date_provider_id_placement_country_device_os_key" ON "ad_revenue"("date", "provider_id", "placement", "country", "device", "os");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payment_gateways_slug_key" ON "payment_gateways"("slug");

-- CreateIndex
CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_channel_id_key" ON "favorites"("user_id", "channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_movie_id_key" ON "favorites"("user_id", "movie_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_series_id_key" ON "favorites"("user_id", "series_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_channel_id_movie_id_series_id_key" ON "favorites"("user_id", "channel_id", "movie_id", "series_id");

-- CreateIndex
CREATE INDEX "watch_history_user_id_idx" ON "watch_history"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "watch_history_user_id_episode_id_key" ON "watch_history"("user_id", "episode_id");

-- CreateIndex
CREATE INDEX "search_history_user_id_idx" ON "search_history"("user_id");

-- CreateIndex
CREATE INDEX "search_history_created_at_idx" ON "search_history"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "search_history_user_id_query_key" ON "search_history"("user_id", "query");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_name_key" ON "feature_flags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "geo_restrictions_country_code_key" ON "geo_restrictions"("country_code");

-- CreateIndex
CREATE UNIQUE INDEX "parental_settings_user_id_key" ON "parental_settings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_no_key" ON "support_tickets"("ticket_no");

-- CreateIndex
CREATE UNIQUE INDEX "sports_name_key" ON "sports"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sports_slug_key" ON "sports"("slug");

-- CreateIndex
CREATE INDEX "sports_is_active_idx" ON "sports"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_sport_id_idx" ON "tournaments"("sport_id");

-- CreateIndex
CREATE INDEX "tournaments_is_active_idx" ON "tournaments"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "sport_teams_slug_key" ON "sport_teams"("slug");

-- CreateIndex
CREATE INDEX "sport_teams_tournament_id_idx" ON "sport_teams"("tournament_id");

-- CreateIndex
CREATE INDEX "sport_teams_is_active_idx" ON "sport_teams"("is_active");

-- CreateIndex
CREATE INDEX "matches_sport_id_idx" ON "matches"("sport_id");

-- CreateIndex
CREATE INDEX "matches_tournament_id_idx" ON "matches"("tournament_id");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "matches_scheduled_at_idx" ON "matches"("scheduled_at");

-- CreateIndex
CREATE INDEX "matches_team_a_id_idx" ON "matches"("team_a_id");

-- CreateIndex
CREATE INDEX "matches_team_b_id_idx" ON "matches"("team_b_id");

-- CreateIndex
CREATE INDEX "match_commentary_match_id_timestamp_idx" ON "match_commentary"("match_id", "timestamp");

-- CreateIndex
CREATE INDEX "match_alerts_user_id_idx" ON "match_alerts"("user_id");

-- CreateIndex
CREATE INDEX "match_alerts_match_id_idx" ON "match_alerts"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_alerts_user_id_match_id_key" ON "match_alerts"("user_id", "match_id");

-- CreateIndex
CREATE INDEX "user_favorite_teams_user_id_idx" ON "user_favorite_teams"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorite_teams_user_id_team_id_key" ON "user_favorite_teams"("user_id", "team_id");

-- CreateIndex
CREATE INDEX "downloads_user_id_idx" ON "downloads"("user_id");

-- CreateIndex
CREATE INDEX "downloads_status_idx" ON "downloads"("status");

-- CreateIndex
CREATE INDEX "reviews_content_type_content_id_idx" ON "reviews"("content_type", "content_id");

-- CreateIndex
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "import_jobs_status_idx" ON "import_jobs"("status");

-- CreateIndex
CREATE INDEX "import_jobs_created_at_idx" ON "import_jobs"("created_at");

-- CreateIndex
CREATE INDEX "import_channels_import_job_id_idx" ON "import_channels"("import_job_id");

-- CreateIndex
CREATE INDEX "import_channels_status_idx" ON "import_channels"("status");

-- CreateIndex
CREATE INDEX "import_channels_channel_name_idx" ON "import_channels"("channel_name");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otps" ADD CONSTRAINT "otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_servers" ADD CONSTRAINT "channel_servers_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_servers" ADD CONSTRAINT "channel_servers_github_source_id_fkey" FOREIGN KEY ("github_source_id") REFERENCES "github_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_sync_logs" ADD CONSTRAINT "github_sync_logs_github_source_id_fkey" FOREIGN KEY ("github_source_id") REFERENCES "github_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playback_events" ADD CONSTRAINT "playback_events_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movies" ADD CONSTRAINT "movies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epg_programs" ADD CONSTRAINT "epg_programs_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ad_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ad_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parental_settings" ADD CONSTRAINT "parental_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sport_teams" ADD CONSTRAINT "sport_teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_a_id_fkey" FOREIGN KEY ("team_a_id") REFERENCES "sport_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_b_id_fkey" FOREIGN KEY ("team_b_id") REFERENCES "sport_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "sport_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_commentary" ADD CONSTRAINT "match_commentary_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_alerts" ADD CONSTRAINT "match_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_alerts" ADD CONSTRAINT "match_alerts_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite_teams" ADD CONSTRAINT "user_favorite_teams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite_teams" ADD CONSTRAINT "user_favorite_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "sport_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_channels" ADD CONSTRAINT "import_channels_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
