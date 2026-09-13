-- Story 129 — Admin Branding & Navigation Layout Customization
--
-- Purely additive: one new enum plus two new nullable columns on the
-- existing `BrandingConfig` row. Nothing is dropped, altered or backfilled.
--
-- Both columns are nullable on purpose. `NULL` means "this branch never
-- configured it", which is every branch at the moment this migration runs:
-- `app_name` falls back to the translated `workspace.appName` string the
-- app already ships, and `navigation_layout` resolves to `NAVBAR` — the
-- exact presentation the Agent Workspace had before this story. No branch
-- changes appearance on upgrade, so there is nothing to backfill.
--
-- Rolling this back is equally safe: pre-Story-129 code never selects
-- either column, so leaving them in place is harmless and dropping them
-- loses nothing that existed before this story.

-- CreateEnum
CREATE TYPE "admin"."NavigationLayout" AS ENUM ('SIDEBAR', 'NAVBAR');

-- AlterTable
ALTER TABLE "admin"."branding_configs" ADD COLUMN     "app_name" TEXT,
ADD COLUMN     "navigation_layout" "admin"."NavigationLayout";
