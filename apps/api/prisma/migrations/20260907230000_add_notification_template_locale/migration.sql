-- RM-30 — Notification Templates: locale-aware content
--
-- Adds a nullable `locale` column: `NULL` (every existing row) means
-- "shown to every viewer regardless of locale" — this table's own
-- unchanged, original behavior. A non-null value ("en"/"ar") lets an
-- admin layer a locale-specific override on top of the branch's own
-- default template for that event type.
--
-- The old plain `(branch_id, event_type)` unique index is dropped: Postgres
-- treats every NULL as distinct from every other in a unique index, so a
-- plain `(branch_id, event_type, locale)` index would silently allow more
-- than one "default" (locale IS NULL) row per event type. The replacement
-- expression index below collapses NULL to '' via COALESCE first, so
-- exactly one default row (and exactly one row per real locale) is
-- enforced per (branch_id, event_type) — this is why schema.prisma
-- declares no `@@unique` for this model (see that model's own doc
-- comment): Prisma's DSL cannot express an expression-based unique index.

-- DropIndex
DROP INDEX "notifications"."notification_templates_branch_id_event_type_key";

-- AlterTable
ALTER TABLE "notifications"."notification_templates" ADD COLUMN "locale" TEXT;

-- CreateIndex
CREATE INDEX "notification_templates_branch_id_event_type_idx" ON "notifications"."notification_templates"("branch_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_branch_event_locale_key" ON "notifications"."notification_templates"("branch_id", "event_type", (COALESCE("locale", '')));
