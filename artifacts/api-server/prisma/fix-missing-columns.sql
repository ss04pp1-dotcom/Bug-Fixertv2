-- =============================================================================
-- ⚠️  ARCHIVED — DO NOT RUN THIS IN ANY ENVIRONMENT  ⚠️
-- =============================================================================
-- This file was an ad-hoc emergency SQL script used to patch missing columns
-- BEFORE proper Prisma migrations existed. It is now SUPERSEDED by:
--
--   prisma/migrations/  ← use `prisma migrate deploy` instead
--
-- Running this script against a database that was already migrated via Prisma
-- will cause duplicate-column errors or silently conflict with migration state.
--
-- If you need to replay schema changes, run:
--   pnpm --filter @workspace/api-server run migrate:deploy
--
-- This file is kept for historical reference ONLY. It will be deleted in the
-- next major release. Do not add new statements here — always create a Prisma
-- migration instead: `pnpm --filter @workspace/api-server run migrate:create`
-- =============================================================================

-- =============================================================================
-- StreamPro — safe incremental migration
-- Run this in Render → PostgreSQL → PSQL Console (or any SQL client)
-- Every statement uses IF NOT EXISTS / DO $$ … $$ so it is safe to re-run.
-- =============================================================================

-- ── 1. Enum types ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE channel_stream_status AS ENUM ('pending','checking','active','offline','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE health_override AS ENUM ('AUTO','FORCE_HEALTHY','FORCE_OFFLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE health_check_mode AS ENUM ('SERVER','USER_PLAYBACK','DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE server_source_type AS ENUM ('ADMIN','GITHUB');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE github_sync_status AS ENUM ('pending','running','success','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_job_status AS ENUM ('pending','parsing','validating','completing','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE import_channel_status AS ENUM ('pending','checking','active','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. channels table ─────────────────────────────────────────────────────────

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS backup_stream_url       TEXT,
  ADD COLUMN IF NOT EXISTS third_backup_url        TEXT,
  ADD COLUMN IF NOT EXISTS normalized_name         TEXT,
  ADD COLUMN IF NOT EXISTS github_channel_id       TEXT,
  ADD COLUMN IF NOT EXISTS admin_name_override     TEXT,
  ADD COLUMN IF NOT EXISTS admin_logo_override     TEXT,
  ADD COLUMN IF NOT EXISTS admin_category_id_override UUID;

-- stream_status uses enum — add only if missing
DO $$ BEGIN
  ALTER TABLE channels
    ADD COLUMN stream_status channel_stream_status NOT NULL DEFAULT 'active';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- health_override uses enum — add only if missing
DO $$ BEGIN
  ALTER TABLE channels
    ADD COLUMN health_override health_override NOT NULL DEFAULT 'AUTO';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- health_check_mode uses enum — add only if missing
DO $$ BEGIN
  ALTER TABLE channels
    ADD COLUMN health_check_mode health_check_mode NOT NULL DEFAULT 'SERVER';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- ── 3. channel_servers table ──────────────────────────────────────────────────

-- source_type uses enum — add only if missing
DO $$ BEGIN
  ALTER TABLE channel_servers
    ADD COLUMN source_type server_source_type NOT NULL DEFAULT 'ADMIN';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

ALTER TABLE channel_servers
  ADD COLUMN IF NOT EXISTS github_source_id    UUID,
  ADD COLUMN IF NOT EXISTS github_channel_id   TEXT,
  ADD COLUMN IF NOT EXISTS health_check_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_seen_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_sync      BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 4. github_sources table ───────────────────────────────────────────────────

ALTER TABLE github_sources
  ADD COLUMN IF NOT EXISTS sync_interval_minutes   INT          NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS last_modified           TEXT,
  ADD COLUMN IF NOT EXISTS last_fetched_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_successful_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_message       TEXT,
  ADD COLUMN IF NOT EXISTS consecutive_failures    INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_syncing              BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sync_started_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS channel_count           INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS server_count            INT          NOT NULL DEFAULT 0,
  -- Per-source default HTTP headers (fallback when M3U/JSON entries have none)
  ADD COLUMN IF NOT EXISTS cookie                  TEXT,
  ADD COLUMN IF NOT EXISTS user_agent              TEXT,
  ADD COLUMN IF NOT EXISTS referer                 TEXT,
  ADD COLUMN IF NOT EXISTS origin                  TEXT;

-- last_sync_status uses enum — add only if missing
DO $$ BEGIN
  ALTER TABLE github_sources
    ADD COLUMN last_sync_status github_sync_status;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- ── 5. github_sync_logs table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS github_sync_logs (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  github_source_id UUID         NOT NULL REFERENCES github_sources(id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ  NOT NULL,
  ended_at         TIMESTAMPTZ,
  duration_ms      INT,
  status           github_sync_status NOT NULL,
  added            INT          NOT NULL DEFAULT 0,
  updated          INT          NOT NULL DEFAULT 0,
  deleted          INT          NOT NULL DEFAULT 0,
  failed           INT          NOT NULL DEFAULT 0,
  total_parsed     INT          NOT NULL DEFAULT 0,
  error_message    TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS github_sync_logs_github_source_id_idx ON github_sync_logs(github_source_id);
CREATE INDEX IF NOT EXISTS github_sync_logs_created_at_idx ON github_sync_logs(created_at);

-- ── 6. channel_merge_logs table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS channel_merge_logs (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger              TEXT         NOT NULL,
  normalized_name      TEXT         NOT NULL,
  kept_channel_id      TEXT         NOT NULL,
  merged_channel_ids   TEXT[]       NOT NULL DEFAULT '{}',
  servers_moved        INT          NOT NULL DEFAULT 0,
  servers_deduplicated INT          NOT NULL DEFAULT 0,
  details              JSONB,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS channel_merge_logs_created_at_idx ON channel_merge_logs(created_at);
CREATE INDEX IF NOT EXISTS channel_merge_logs_kept_channel_id_idx ON channel_merge_logs(kept_channel_id);

-- ── 7. deleted_channel_logs table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deleted_channel_logs (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name  TEXT         NOT NULL,
  stream_url    TEXT,
  logo          TEXT,
  category_name TEXT,
  delete_reason TEXT         NOT NULL,
  deleted_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS deleted_channel_logs_deleted_at_idx ON deleted_channel_logs(deleted_at);

-- ── 8. movies table ───────────────────────────────────────────────────────────

ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS backup_stream_url TEXT,
  ADD COLUMN IF NOT EXISTS cookie            TEXT,
  ADD COLUMN IF NOT EXISTS user_agent        TEXT,
  ADD COLUMN IF NOT EXISTS referer           TEXT,
  ADD COLUMN IF NOT EXISTS origin            TEXT;

-- ── 9. episodes table ────────────────────────────────────────────────────────

ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS backup_stream_url TEXT,
  ADD COLUMN IF NOT EXISTS cookie            TEXT,
  ADD COLUMN IF NOT EXISTS user_agent        TEXT,
  ADD COLUMN IF NOT EXISTS referer           TEXT,
  ADD COLUMN IF NOT EXISTS origin            TEXT;

-- ── 10. settings table (for scheduler/keep-alive keys) ───────────────────────

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Done ──────────────────────────────────────────────────────────────────────
SELECT 'Migration complete — all missing columns and tables added.' AS result;
