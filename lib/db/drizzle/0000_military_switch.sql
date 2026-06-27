CREATE TYPE "public"."ad_event_type" AS ENUM('impression', 'click', 'error', 'session', 'revenue');--> statement-breakpoint
CREATE TYPE "public"."ad_type" AS ENUM('banner', 'video', 'popup', 'interstitial', 'rewarded', 'native', 'app_open', 'splash');--> statement-breakpoint
CREATE TYPE "public"."audit_level" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."channel_stream_status" AS ENUM('pending', 'checking', 'active', 'offline', 'failed');--> statement-breakpoint
CREATE TYPE "public"."coupon_discount_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."download_status" AS ENUM('pending', 'downloading', 'completed', 'failed', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."github_sync_status" AS ENUM('pending', 'running', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."health_check_mode" AS ENUM('SERVER', 'USER_PLAYBACK', 'DISABLED');--> statement-breakpoint
CREATE TYPE "public"."health_override" AS ENUM('AUTO', 'FORCE_HEALTHY', 'FORCE_OFFLINE');--> statement-breakpoint
CREATE TYPE "public"."import_channel_status" AS ENUM('pending', 'checking', 'active', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."import_job_status" AS ENUM('pending', 'parsing', 'validating', 'completing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('upcoming', 'live', 'completed', 'postponed', 'cancelled', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('push', 'in_app', 'email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."server_source_type" AS ENUM('ADMIN', 'GITHUB');--> statement-breakpoint
CREATE TYPE "public"."sport_type" AS ENUM('cricket', 'football', 'tennis', 'basketball', 'baseball', 'hockey', 'mma', 'boxing', 'f1', 'golf', 'other');--> statement-breakpoint
CREATE TYPE "public"."stream_type" AS ENUM('HLS', 'M3U', 'RTMP', 'DASH');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('inactive', 'active', 'expired', 'cancelled', 'trial', 'pending', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'moderator', 'editor', 'support', 'user');--> statement-breakpoint
CREATE TABLE "ad_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "event_type" "ad_event_type" NOT NULL,
        "provider_id" uuid,
        "ad_id" uuid,
        "placement" text,
        "country" text,
        "device" text,
        "os" text,
        "revenue" real,
        "error_code" text,
        "error_msg" text,
        "session_id" text,
        "user_id" uuid,
        "metadata" json,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_placements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "type" "ad_type" NOT NULL,
        "screen" text NOT NULL,
        "is_enabled" boolean DEFAULT true NOT NULL,
        "frequency" integer DEFAULT 1 NOT NULL,
        "cooldown_seconds" integer DEFAULT 0 NOT NULL,
        "skip_after_seconds" integer,
        "description" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "ad_placements_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ad_providers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "api_key" text,
        "app_id" text,
        "ad_unit_banner" text,
        "ad_unit_interstitial" text,
        "ad_unit_rewarded" text,
        "ad_unit_native" text,
        "ad_unit_app_open" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "is_selected" boolean DEFAULT false NOT NULL,
        "is_test_mode" boolean DEFAULT true NOT NULL,
        "config" json,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "ad_providers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ad_revenue" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "date" date NOT NULL,
        "provider_id" uuid,
        "placement" text,
        "country" text,
        "device" text,
        "os" text,
        "impressions" integer DEFAULT 0 NOT NULL,
        "clicks" integer DEFAULT 0 NOT NULL,
        "revenue" real DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "ad_revenue_date_provider_id_placement_country_device_os_unique" UNIQUE("date","provider_id","placement","country","device","os")
);
--> statement-breakpoint
CREATE TABLE "ad_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "key" text NOT NULL,
        "active_provider_id" uuid,
        "max_ads_per_session" integer DEFAULT 5 NOT NULL,
        "max_ads_per_day" integer DEFAULT 20 NOT NULL,
        "cooldown_seconds" integer DEFAULT 30 NOT NULL,
        "min_interval_seconds" integer DEFAULT 60 NOT NULL,
        "interstitial_every_n_screens" integer DEFAULT 3 NOT NULL,
        "interstitial_every_n_minutes" integer DEFAULT 5 NOT NULL,
        "rewarded_cooldown_seconds" integer DEFAULT 120 NOT NULL,
        "frequency_cap" integer DEFAULT 10 NOT NULL,
        "is_enabled" boolean DEFAULT true NOT NULL,
        "force_update" boolean DEFAULT false NOT NULL,
        "maintenance_mode" boolean DEFAULT false NOT NULL,
        "maintenance_message" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "ad_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "advertisements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "type" "ad_type" DEFAULT 'banner' NOT NULL,
        "image_url" text,
        "video_url" text,
        "target_url" text,
        "duration" integer,
        "provider_id" uuid,
        "country" text,
        "language" text,
        "is_premium" boolean DEFAULT false NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "start_date" timestamp,
        "end_date" timestamp,
        "impressions" integer DEFAULT 0 NOT NULL,
        "clicks" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "type" text DEFAULT 'banner' NOT NULL,
        "priority" integer DEFAULT 0 NOT NULL,
        "image_url" text,
        "deep_link" text,
        "is_dismissible" boolean DEFAULT true NOT NULL,
        "target_all" boolean DEFAULT true NOT NULL,
        "country" text,
        "language" text,
        "is_premium" boolean,
        "starts_at" timestamp,
        "expires_at" timestamp,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid,
        "action" text NOT NULL,
        "resource" text NOT NULL,
        "resource_id" text,
        "old_values" json,
        "new_values" json,
        "ip_address" text,
        "user_agent" text,
        "level" "audit_level" DEFAULT 'info' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "image_url" text,
        "link" text,
        "position" text DEFAULT 'home_hero' NOT NULL,
        "is_active" boolean DEFAULT false NOT NULL,
        "priority" integer DEFAULT 0 NOT NULL,
        "starts_at" timestamp,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "icon" text,
        "image" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "channel_servers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "channel_id" uuid NOT NULL,
        "link" text NOT NULL,
        "cookie" text,
        "user_agent" text,
        "referer" text,
        "origin" text,
        "priority" integer DEFAULT 100 NOT NULL,
        "source_type" "server_source_type" DEFAULT 'ADMIN' NOT NULL,
        "github_source_id" uuid,
        "github_channel_id" text,
        "enabled" boolean DEFAULT true NOT NULL,
        "health_check_enabled" boolean DEFAULT true NOT NULL,
        "last_seen_at" timestamp,
        "created_by_sync" boolean DEFAULT false NOT NULL,
        "deleted_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_merge_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "trigger" text NOT NULL,
        "normalized_name" text NOT NULL,
        "kept_channel_id" text NOT NULL,
        "merged_channel_ids" text[] DEFAULT '{}' NOT NULL,
        "servers_moved" integer DEFAULT 0 NOT NULL,
        "servers_deduplicated" integer DEFAULT 0 NOT NULL,
        "details" json,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "logo" text,
        "thumbnail" text,
        "banner" text,
        "category_id" uuid,
        "language" text,
        "country" text,
        "primary_stream_url" text,
        "backup_stream_url" text,
        "third_backup_url" text,
        "stream_type" "stream_type" DEFAULT 'HLS' NOT NULL,
        "epg_channel_id" text,
        "stream_status" "channel_stream_status" DEFAULT 'active' NOT NULL,
        "health_override" "health_override" DEFAULT 'AUTO' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "is_featured" boolean DEFAULT false NOT NULL,
        "is_trending" boolean DEFAULT false NOT NULL,
        "is_premium" boolean DEFAULT false NOT NULL,
        "is_live" boolean DEFAULT true NOT NULL,
        "view_count" integer DEFAULT 0 NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "tags" text[] DEFAULT '{}',
        "last_active_at" timestamp,
        "normalized_name" text,
        "github_channel_id" text,
        "admin_name_override" text,
        "admin_logo_override" text,
        "admin_category_id_override" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        CONSTRAINT "channels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "coupon_usage" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "coupon_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "used_at" timestamp DEFAULT now() NOT NULL,
        "discount" real NOT NULL,
        "plan_id" uuid
);
--> statement-breakpoint
CREATE TABLE "coupons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "code" text NOT NULL,
        "discount_type" "coupon_discount_type" NOT NULL,
        "discount_value" real NOT NULL,
        "min_purchase" real,
        "max_uses" integer,
        "used_count" integer DEFAULT 0 NOT NULL,
        "per_user_limit" integer DEFAULT 1 NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "expires_at" timestamp,
        "plan_ids" uuid[] DEFAULT '{}',
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "deleted_channel_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "channel_name" text NOT NULL,
        "stream_url" text,
        "logo" text,
        "category_name" text,
        "delete_reason" text NOT NULL,
        "deleted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "downloads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "content_type" text DEFAULT 'movie' NOT NULL,
        "content_id" text NOT NULL,
        "title" text NOT NULL,
        "poster" text,
        "stream_url" text NOT NULL,
        "quality" text DEFAULT '720p' NOT NULL,
        "file_size" integer DEFAULT 0 NOT NULL,
        "progress" real DEFAULT 0 NOT NULL,
        "status" "download_status" DEFAULT 'pending' NOT NULL,
        "file_path" text,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "epg_programs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "channel_id" uuid NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "start_time" timestamp NOT NULL,
        "end_time" timestamp NOT NULL,
        "category" text,
        "poster" text,
        "rating" text,
        "is_live" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "season_id" uuid NOT NULL,
        "episode_number" integer NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "thumbnail" text,
        "stream_url" text,
        "duration" integer,
        "age_rating" text,
        "is_premium" boolean DEFAULT false NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "view_count" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "episodes_season_id_episode_number_unique" UNIQUE("season_id","episode_number")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "channel_id" uuid,
        "movie_id" uuid,
        "series_id" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "is_enabled" boolean DEFAULT false NOT NULL,
        "description" text,
        "roles" text[] DEFAULT '{}',
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "feature_flags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "geo_restrictions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "country_code" text NOT NULL,
        "is_blocked" boolean DEFAULT true NOT NULL,
        "reason" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "geo_restrictions_country_code_unique" UNIQUE("country_code")
);
--> statement-breakpoint
CREATE TABLE "github_sources" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "url" text NOT NULL,
        "enabled" boolean DEFAULT true NOT NULL,
        "sync_interval_minutes" integer DEFAULT 10 NOT NULL,
        "etag" text,
        "last_modified" text,
        "last_fetched_at" timestamp,
        "last_sync_at" timestamp,
        "last_successful_sync_at" timestamp,
        "last_sync_status" "github_sync_status",
        "last_sync_message" text,
        "consecutive_failures" integer DEFAULT 0 NOT NULL,
        "is_syncing" boolean DEFAULT false NOT NULL,
        "sync_started_at" timestamp,
        "channel_count" integer DEFAULT 0 NOT NULL,
        "server_count" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_sync_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "github_source_id" uuid NOT NULL,
        "started_at" timestamp NOT NULL,
        "ended_at" timestamp,
        "duration_ms" integer,
        "status" "github_sync_status" NOT NULL,
        "added" integer DEFAULT 0 NOT NULL,
        "updated" integer DEFAULT 0 NOT NULL,
        "deleted" integer DEFAULT 0 NOT NULL,
        "failed" integer DEFAULT 0 NOT NULL,
        "total_parsed" integer DEFAULT 0 NOT NULL,
        "error_message" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_channels" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "import_job_id" uuid NOT NULL,
        "channel_name" text NOT NULL,
        "stream_url" text NOT NULL,
        "logo_url" text,
        "group_category" text,
        "status" "import_channel_status" DEFAULT 'pending' NOT NULL,
        "fail_reason" text,
        "http_status" integer,
        "response_time_ms" integer,
        "retry_count" integer DEFAULT 0 NOT NULL,
        "channel_id" uuid,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "filename" text NOT NULL,
        "file_path" text NOT NULL,
        "file_size" integer NOT NULL,
        "status" "import_job_status" DEFAULT 'pending' NOT NULL,
        "total_channels" integer DEFAULT 0 NOT NULL,
        "checked_channels" integer DEFAULT 0 NOT NULL,
        "active_channels" integer DEFAULT 0 NOT NULL,
        "failed_channels" integer DEFAULT 0 NOT NULL,
        "skipped_channels" integer DEFAULT 0 NOT NULL,
        "batch_size" integer DEFAULT 50 NOT NULL,
        "save_failed" boolean DEFAULT false NOT NULL,
        "started_at" timestamp,
        "completed_at" timestamp,
        "error_message" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_alerts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "match_id" uuid NOT NULL,
        "is_enabled" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "match_alerts_user_id_match_id_unique" UNIQUE("user_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "match_commentary" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "match_id" uuid NOT NULL,
        "event_type" text DEFAULT 'general' NOT NULL,
        "text" text NOT NULL,
        "score" text,
        "over" text,
        "minute" integer,
        "timestamp" timestamp DEFAULT now() NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text,
        "sport_id" uuid NOT NULL,
        "tournament_id" uuid NOT NULL,
        "team_a_id" uuid NOT NULL,
        "team_b_id" uuid NOT NULL,
        "scheduled_at" timestamp NOT NULL,
        "status" "match_status" DEFAULT 'upcoming' NOT NULL,
        "venue" text,
        "stream_url" text,
        "live_url" text,
        "team_a_score" text,
        "team_b_score" text,
        "winner_id" uuid,
        "description" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "view_count" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "movies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "poster" text,
        "banner" text,
        "trailer_url" text,
        "stream_url" text,
        "category_id" uuid,
        "genres" text[] DEFAULT '{}',
        "cast" text[] DEFAULT '{}',
        "director" text,
        "year" integer,
        "duration" integer,
        "rating" real,
        "age_rating" text,
        "language" text,
        "country" text,
        "is_premium" boolean DEFAULT false NOT NULL,
        "is_featured" boolean DEFAULT false NOT NULL,
        "is_trending" boolean DEFAULT false NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "view_count" integer DEFAULT 0 NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        CONSTRAINT "movies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "notification_id" uuid NOT NULL,
        "read_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "notification_reads_user_id_notification_id_unique" UNIQUE("user_id","notification_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "type" "notification_type" DEFAULT 'push' NOT NULL,
        "target_all" boolean DEFAULT false NOT NULL,
        "target_roles" text[] DEFAULT '{}',
        "target_users" uuid[] DEFAULT '{}',
        "country" text,
        "language" text,
        "is_premium" boolean,
        "image_url" text,
        "deep_link" text,
        "scheduled_at" timestamp,
        "sent_at" timestamp,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otps" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid,
        "identifier" text NOT NULL,
        "code" text NOT NULL,
        "type" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "used_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parental_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "pin" text,
        "max_age_rating" text,
        "restricted_categories" uuid[] DEFAULT '{}',
        "is_enabled" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "parental_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "payment_gateways" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "is_test_mode" boolean DEFAULT true NOT NULL,
        "public_key" text,
        "secret_key" text,
        "webhook_secret" text,
        "config" json,
        "fee_percent" real DEFAULT 0 NOT NULL,
        "fixed_fee" real DEFAULT 0 NOT NULL,
        "currencies" text[] DEFAULT '{}',
        "countries" text[] DEFAULT '{}',
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "payment_gateways_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "subscription_id" uuid,
        "gateway" text NOT NULL,
        "gateway_tx_id" text,
        "amount" real NOT NULL,
        "currency" text DEFAULT 'USD' NOT NULL,
        "status" "payment_status" DEFAULT 'pending' NOT NULL,
        "invoice_number" text,
        "refund_reason" text,
        "webhook_payload" json,
        "metadata" json,
        "paid_at" timestamp,
        "refunded_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "payments_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "playback_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "channel_id" uuid NOT NULL,
        "user_id" uuid,
        "success" boolean NOT NULL,
        "duration" integer,
        "app_version" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "content_type" text NOT NULL,
        "content_id" text NOT NULL,
        "rating" integer NOT NULL,
        "title" text,
        "comment" text,
        "is_approved" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "permissions" text[] DEFAULT '{}',
        "is_system" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "search_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "query" text NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "series_id" uuid NOT NULL,
        "season_number" integer NOT NULL,
        "title" text,
        "description" text,
        "poster" text,
        "year" integer,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "seasons_series_id_season_number_unique" UNIQUE("series_id","season_number")
);
--> statement-breakpoint
CREATE TABLE "series" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "poster" text,
        "banner" text,
        "trailer_url" text,
        "category_id" uuid,
        "genres" text[] DEFAULT '{}',
        "cast" text[] DEFAULT '{}',
        "director" text,
        "year" integer,
        "age_rating" text,
        "language" text,
        "country" text,
        "is_premium" boolean DEFAULT false NOT NULL,
        "is_featured" boolean DEFAULT false NOT NULL,
        "is_trending" boolean DEFAULT false NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "view_count" integer DEFAULT 0 NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        CONSTRAINT "series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "refresh_token" text NOT NULL,
        "device_name" text,
        "device_type" text,
        "platform" text,
        "ip_address" text,
        "user_agent" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "expires_at" timestamp NOT NULL,
        CONSTRAINT "sessions_refresh_token_unique" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "key" text NOT NULL,
        "value" json NOT NULL,
        "description" text,
        "is_public" boolean DEFAULT false NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sport_teams" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "short_name" text,
        "abbr" text,
        "logo" text,
        "country" text,
        "primary_color" text,
        "secondary_color" text,
        "tournament_id" uuid,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        CONSTRAINT "sport_teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "icon" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        CONSTRAINT "sports_name_unique" UNIQUE("name"),
        CONSTRAINT "sports_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscription_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "subscription_id" uuid,
        "plan_id" uuid,
        "from_status" "subscription_status",
        "to_status" "subscription_status" NOT NULL,
        "reason" text,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "price" real NOT NULL,
        "currency" text DEFAULT 'USD' NOT NULL,
        "duration_days" integer NOT NULL,
        "features" text[] DEFAULT '{}',
        "is_active" boolean DEFAULT true NOT NULL,
        "is_featured" boolean DEFAULT false NOT NULL,
        "trial_days" integer DEFAULT 0 NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "plan_id" uuid NOT NULL,
        "status" "subscription_status" DEFAULT 'active' NOT NULL,
        "started_at" timestamp DEFAULT now() NOT NULL,
        "ends_at" timestamp NOT NULL,
        "trial_ends_at" timestamp,
        "renewed_at" timestamp,
        "next_renewal_at" timestamp,
        "cancelled_at" timestamp,
        "coupon_code" text,
        "discount" real,
        "auto_renew" boolean DEFAULT true NOT NULL,
        "grace_period_days" integer DEFAULT 3 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "subscriptions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "ticket_no" text NOT NULL,
        "user_email" text NOT NULL,
        "subject" text NOT NULL,
        "description" text,
        "priority" text DEFAULT 'Medium' NOT NULL,
        "status" text DEFAULT 'Open' NOT NULL,
        "assigned_to" text,
        "resolved_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "support_tickets_ticket_no_unique" UNIQUE("ticket_no")
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "logo" text,
        "banner" text,
        "country" text,
        "sport_id" uuid NOT NULL,
        "start_date" timestamp,
        "end_date" timestamp,
        "is_active" boolean DEFAULT true NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        CONSTRAINT "tournaments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_favorite_teams" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "team_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "user_favorite_teams_user_id_team_id_unique" UNIQUE("user_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "email" text,
        "phone" text,
        "password_hash" text,
        "avatar" text,
        "role" "user_role" DEFAULT 'user' NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "email_verified" boolean DEFAULT false NOT NULL,
        "phone_verified" boolean DEFAULT false NOT NULL,
        "is_premium" boolean DEFAULT false NOT NULL,
        "subscription_ends_at" timestamp,
        "country" text,
        "language" text DEFAULT 'en',
        "fcm_token" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "deleted_at" timestamp,
        CONSTRAINT "users_email_unique" UNIQUE("email"),
        CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "watch_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "movie_id" uuid,
        "series_id" uuid,
        "episode_id" uuid,
        "position" integer DEFAULT 0 NOT NULL,
        "duration" integer,
        "completed" boolean DEFAULT false NOT NULL,
        "watched_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_events" ADD CONSTRAINT "ad_events_provider_id_ad_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ad_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advertisements" ADD CONSTRAINT "advertisements_provider_id_ad_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ad_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_servers" ADD CONSTRAINT "channel_servers_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_servers" ADD CONSTRAINT "channel_servers_github_source_id_github_sources_id_fk" FOREIGN KEY ("github_source_id") REFERENCES "public"."github_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epg_programs" ADD CONSTRAINT "epg_programs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_sync_logs" ADD CONSTRAINT "github_sync_logs_github_source_id_github_sources_id_fk" FOREIGN KEY ("github_source_id") REFERENCES "public"."github_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_channels" ADD CONSTRAINT "import_channels_import_job_id_import_jobs_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_alerts" ADD CONSTRAINT "match_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_alerts" ADD CONSTRAINT "match_alerts_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_commentary" ADD CONSTRAINT "match_commentary_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_a_id_sport_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."sport_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_b_id_sport_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."sport_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_sport_teams_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."sport_teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movies" ADD CONSTRAINT "movies_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otps" ADD CONSTRAINT "otps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parental_settings" ADD CONSTRAINT "parental_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playback_events" ADD CONSTRAINT "playback_events_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sport_teams" ADD CONSTRAINT "sport_teams_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_sport_id_sports_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_teams" ADD CONSTRAINT "user_favorite_teams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_favorite_teams" ADD CONSTRAINT "user_favorite_teams_team_id_sport_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."sport_teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "channel_servers_channel_id_idx" ON "channel_servers" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "channel_servers_github_source_id_idx" ON "channel_servers" USING btree ("github_source_id");--> statement-breakpoint
CREATE INDEX "channel_servers_source_type_idx" ON "channel_servers" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "channel_servers_deleted_at_idx" ON "channel_servers" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "channels_is_active_idx" ON "channels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "channels_category_id_idx" ON "channels" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "channels_created_at_idx" ON "channels" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "channels_last_active_at_idx" ON "channels" USING btree ("last_active_at");--> statement-breakpoint
CREATE INDEX "channels_normalized_name_idx" ON "channels" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "channel_merge_logs_created_at_idx" ON "channel_merge_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "channel_merge_logs_kept_channel_id_idx" ON "channel_merge_logs" USING btree ("kept_channel_id");--> statement-breakpoint
CREATE INDEX "deleted_channel_logs_deleted_at_idx" ON "deleted_channel_logs" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "downloads_user_id_idx" ON "downloads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "downloads_status_idx" ON "downloads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "favorites_user_id_idx" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "github_sources_enabled_idx" ON "github_sources" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "github_sync_logs_source_id_idx" ON "github_sync_logs" USING btree ("github_source_id");--> statement-breakpoint
CREATE INDEX "github_sync_logs_created_at_idx" ON "github_sync_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "import_channels_job_id_idx" ON "import_channels" USING btree ("import_job_id");--> statement-breakpoint
CREATE INDEX "import_channels_status_idx" ON "import_channels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_channels_channel_name_idx" ON "import_channels" USING btree ("channel_name");--> statement-breakpoint
CREATE INDEX "import_jobs_status_idx" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_jobs_created_at_idx" ON "import_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "match_alerts_user_id_idx" ON "match_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "match_alerts_match_id_idx" ON "match_alerts" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_commentary_match_id_ts_idx" ON "match_commentary" USING btree ("match_id","timestamp");--> statement-breakpoint
CREATE INDEX "matches_sport_id_idx" ON "matches" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "matches_tournament_id_idx" ON "matches" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "matches_scheduled_at_idx" ON "matches" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "matches_team_a_id_idx" ON "matches" USING btree ("team_a_id");--> statement-breakpoint
CREATE INDEX "matches_team_b_id_idx" ON "matches" USING btree ("team_b_id");--> statement-breakpoint
CREATE INDEX "movies_is_active_idx" ON "movies" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "movies_category_id_idx" ON "movies" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "movies_created_at_idx" ON "movies" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_reads_user_id_idx" ON "notification_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_subscription_id_idx" ON "payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "playback_events_channel_id_idx" ON "playback_events" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "playback_events_created_at_idx" ON "playback_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reviews_content_idx" ON "reviews" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "reviews_user_id_idx" ON "reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reviews_rating_idx" ON "reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "search_history_user_id_idx" ON "search_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "series_is_active_idx" ON "series" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "series_category_id_idx" ON "series" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "series_created_at_idx" ON "series" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sport_teams_tournament_id_idx" ON "sport_teams" USING btree ("tournament_id");--> statement-breakpoint
CREATE INDEX "sport_teams_is_active_idx" ON "sport_teams" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sports_is_active_idx" ON "sports" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_ends_at_idx" ON "subscriptions" USING btree ("ends_at");--> statement-breakpoint
CREATE INDEX "tournaments_sport_id_idx" ON "tournaments" USING btree ("sport_id");--> statement-breakpoint
CREATE INDEX "tournaments_is_active_idx" ON "tournaments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_favorite_teams_user_id_idx" ON "user_favorite_teams" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watch_history_user_id_idx" ON "watch_history" USING btree ("user_id");