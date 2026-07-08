-- Migration: 20260707000001_add_pgcrypto_composite_indexes
-- Purpose:
--   1. Ensure pgcrypto extension exists (provides gen_random_uuid(), uuid functions).
--      Without this, a fresh DB provisioned without the extension will fail when
--      schema.prisma uses @default(uuid()) on @db.Uuid columns.
--   2. Add composite indexes for high-traffic list queries (Movie, Series, Match,
--      Notification, NotificationRead, AuditLog) that were missing from the initial schema.
--      These prevent full-table scans once data grows beyond a few thousand rows.
-- =============================================================================

-- 1. Extensions (idempotent — safe to run on any Postgres 12+)
-- pgcrypto: provides gen_random_uuid() used by Prisma for @default(uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- uuid-ossp: alternative uuid generator; included for compatibility with some pg versions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 2. Composite indexes — Movies
-- List API: WHERE is_active = true AND deleted_at IS NULL [AND category_id = ?]
CREATE INDEX IF NOT EXISTS movies_active_deleted_category_idx
  ON movies(is_active, deleted_at, category_id);

-- Featured / Trending feeds
CREATE INDEX IF NOT EXISTS movies_featured_active_idx
  ON movies(is_featured, is_active, deleted_at);

CREATE INDEX IF NOT EXISTS movies_trending_active_idx
  ON movies(is_trending, is_active, deleted_at);

CREATE INDEX IF NOT EXISTS movies_premium_active_idx
  ON movies(is_premium, is_active, deleted_at);

-- =============================================================================
-- 3. Composite indexes — Series
CREATE INDEX IF NOT EXISTS series_active_deleted_category_idx
  ON series(is_active, deleted_at, category_id);

CREATE INDEX IF NOT EXISTS series_featured_active_idx
  ON series(is_featured, is_active, deleted_at);

CREATE INDEX IF NOT EXISTS series_trending_active_idx
  ON series(is_trending, is_active, deleted_at);

CREATE INDEX IF NOT EXISTS series_premium_active_idx
  ON series(is_premium, is_active, deleted_at);

-- =============================================================================
-- 4. Composite indexes — Matches (Sports)
-- "Upcoming schedule" view: WHERE status = 'upcoming' ORDER BY scheduled_at ASC
CREATE INDEX IF NOT EXISTS matches_status_scheduled_active_idx
  ON matches(status, scheduled_at, is_active);

-- Admin match list: filter by sport + active
CREATE INDEX IF NOT EXISTS matches_active_deleted_sport_idx
  ON matches(is_active, deleted_at, sport_id);

-- =============================================================================
-- 5. Composite indexes — Notifications
-- Scheduled fan-out job: WHERE is_active = true AND scheduled_at <= NOW()
CREATE INDEX IF NOT EXISTS notifications_active_scheduled_idx
  ON notifications(is_active, scheduled_at);

-- Broadcast target: WHERE target_all = true AND is_active = true
CREATE INDEX IF NOT EXISTS notifications_targetall_active_idx
  ON notifications(target_all, is_active);

-- =============================================================================
-- 6. Composite indexes — NotificationRead
-- "User's read receipts by time" query
CREATE INDEX IF NOT EXISTS notification_reads_user_read_idx
  ON notification_reads(user_id, read_at);

-- =============================================================================
-- 7. Composite indexes — AuditLog
-- Admin audit filter: by resource type + time
CREATE INDEX IF NOT EXISTS audit_logs_resource_created_idx
  ON audit_logs(resource, created_at);

-- Admin audit filter: by severity level + time
CREATE INDEX IF NOT EXISTS audit_logs_level_created_idx
  ON audit_logs(level, created_at);

-- User-scoped audit history
CREATE INDEX IF NOT EXISTS audit_logs_user_created_idx
  ON audit_logs(user_id, created_at);
