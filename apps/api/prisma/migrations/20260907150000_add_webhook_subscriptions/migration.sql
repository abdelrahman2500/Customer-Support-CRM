-- RM-20 — Webhook Subscriptions + Outbound Event Dispatch.
--
-- Hand-written, not `prisma migrate dev`-generated: this repo's
-- `knowledge_base.knowledge_base_articles.search_vector` column is a real
-- Postgres GENERATED ALWAYS AS (...) STORED column that Prisma's diff
-- engine always misreads as needing an invalid `ALTER COLUMN ... DROP
-- DEFAULT` alongside any unrelated schema change — the same known
-- false-positive already documented and worked around in RM-00's, Story
-- 109's, Story 110's, Story 115's, and RM-03's own migrations. Confirmed
-- (again) via direct DB query before writing this file that no such
-- statement belongs here.
--
-- Mirrors RM-03's `add_tasks` migration exactly for the "introduce a
-- brand-new schema" shape (CreateSchema + its own GRANT block extending
-- Story 115's `add_runtime_db_role_grants`, which could not have
-- anticipated a schema that didn't exist yet).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "integrations";

-- CreateTable
CREATE TABLE "integrations"."webhook_subscriptions" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "subscribed_event_types" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations"."webhook_delivery_attempts" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "response_status" INTEGER,
    "error_message" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_subscriptions_branch_id_idx" ON "integrations"."webhook_subscriptions"("branch_id");

-- CreateIndex
CREATE INDEX "webhook_delivery_attempts_subscription_id_attempted_at_idx" ON "integrations"."webhook_delivery_attempts"("subscription_id", "attempted_at");

-- AddForeignKey
ALTER TABLE "integrations"."webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations"."webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations"."webhook_delivery_attempts" ADD CONSTRAINT "webhook_delivery_attempts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "integrations"."webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Extends Story 115's `add_runtime_db_role_grants` to this brand-new
-- schema, identical shape to that migration's other schemas and to RM-03's
-- own precedent for "tasks": ordinary CRUD for the restricted `crm_app`
-- runtime role, plus default privileges so any later migration's future
-- tables in this schema are automatically covered too.
GRANT USAGE ON SCHEMA "integrations" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "integrations" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "integrations"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;
