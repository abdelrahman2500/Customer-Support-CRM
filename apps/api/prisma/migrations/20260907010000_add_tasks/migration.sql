-- RM-03 — Agent Tasks & Reminders.
--
-- Hand-written, not `prisma migrate dev`-generated: this repo's
-- `knowledge_base.knowledge_base_articles.search_vector` column is a real
-- Postgres GENERATED ALWAYS AS (...) STORED column that Prisma's diff
-- engine always misreads as needing an invalid `ALTER COLUMN ... DROP
-- DEFAULT` alongside any unrelated schema change — the same known
-- false-positive already documented and worked around in RM-00's, Story
-- 109's, Story 110's, and Story 115's own migrations. Confirmed (again)
-- via direct DB query before writing this file that no such statement
-- belongs here.
--
-- Mirrors Story 110's `add_report_dashboards` migration exactly for the
-- "introduce a brand-new schema" shape (CreateSchema + its own GRANT
-- block extending Story 115's `add_runtime_db_role_grants`, which could
-- not have anticipated a schema that didn't exist yet).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tasks";

-- CreateEnum
CREATE TYPE "tasks"."TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "tasks"."tasks" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "priority" "tasks"."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "ticket_id" TEXT,
    "customer_id" TEXT,
    "due_at" TIMESTAMP(3),
    "reminder_sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_owner_user_id_idx" ON "tasks"."tasks"("owner_user_id");

-- CreateIndex
CREATE INDEX "tasks_due_at_idx" ON "tasks"."tasks"("due_at");

-- AddForeignKey
ALTER TABLE "tasks"."tasks" ADD CONSTRAINT "tasks_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks"."tasks" ADD CONSTRAINT "tasks_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks"."tasks" ADD CONSTRAINT "tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Extends Story 115's `add_runtime_db_role_grants` to this brand-new
-- schema, identical shape to that migration's other schemas and to
-- Story 110's own precedent for "reporting": ordinary CRUD for the
-- restricted `crm_app` runtime role, plus default privileges so any
-- later migration's future tables in this schema are automatically
-- covered too.
GRANT USAGE ON SCHEMA "tasks" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "tasks" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "tasks"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;
