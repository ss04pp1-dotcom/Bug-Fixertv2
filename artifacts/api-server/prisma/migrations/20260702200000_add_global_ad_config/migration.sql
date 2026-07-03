-- Add global_config JSON column to ad_settings for the Global Ad Rule Engine.
-- IF NOT EXISTS keeps this idempotent across environments.
ALTER TABLE "ad_settings" ADD COLUMN IF NOT EXISTS "global_config" JSONB;
