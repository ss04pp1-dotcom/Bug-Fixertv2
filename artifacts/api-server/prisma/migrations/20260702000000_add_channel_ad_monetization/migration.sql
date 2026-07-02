-- AlterTable: add ad monetization fields to channels
-- isSmartlinkEnabled, smartlinkUrl, vastUrl, bannerHtmlCode

ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "is_smartlink_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "smartlink_url" TEXT;
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "vast_url" TEXT;
ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "banner_html_code" TEXT;
