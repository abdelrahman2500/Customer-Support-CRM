-- Story 130 — Notification Template Lifecycle
--
-- Purely additive: one new column on the existing `notification_templates`
-- row. Nothing is dropped, altered or backfilled.
--
-- `NOT NULL DEFAULT true` is what makes this safe to apply to a populated
-- table: Postgres fills every existing row with `true` as part of the
-- ADD COLUMN, so every template authored before this story stays active
-- and no branch's notification behaviour changes on deploy. That is also
-- why the column is NOT NULL rather than nullable — there is no
-- "unconfigured" state for a lifecycle flag; a template is either in use
-- or it is not.
--
-- This model deliberately has no hard DELETE (see `NotificationTemplate`'s
-- own doc comment): deactivation is the lifecycle, matching every other
-- admin-authored resource in this codebase.
--
-- Rollback is safe in both directions: dropping the column returns the
-- table to its pre-Story-130 shape, and pre-Story-130 code never selects
-- it, so leaving it in place is equally harmless.

-- AlterTable
ALTER TABLE "notifications"."notification_templates"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
