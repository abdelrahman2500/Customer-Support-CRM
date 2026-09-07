-- RM-21 — Inbound Webhook Receiver + Signature Verification Framework.
--
-- Hand-written, not `prisma migrate dev`-generated: this repo's
-- `knowledge_base.knowledge_base_articles.search_vector` column is a real
-- Postgres GENERATED ALWAYS AS (...) STORED column that Prisma's diff
-- engine always misreads as needing an invalid `ALTER COLUMN ... DROP
-- DEFAULT` alongside any unrelated schema change — the same known
-- false-positive already documented and worked around in every prior
-- migration this session (most recently RM-20's own
-- `add_webhook_subscriptions`). Confirmed (again) via direct DB query
-- before writing this file that no such statement belongs here.
--
-- No `CREATE SCHEMA` here — the `integrations` schema already exists
-- (RM-20). Story 115's `add_runtime_db_role_grants` +
-- `add_webhook_subscriptions`'s own `ALTER DEFAULT PRIVILEGES ... IN
-- SCHEMA "integrations"` already covers this new table automatically;
-- the explicit per-table GRANT below is a defensive, always-safe
-- belt-and-suspenders confirmation, not a required addition.

-- CreateTable
CREATE TABLE "integrations"."webhook_inbound_logs" (
    "id" TEXT NOT NULL,
    "provider_key" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "reject_reason" TEXT,
    "headers" JSONB NOT NULL,
    "body" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_inbound_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_inbound_logs_provider_key_received_at_idx" ON "integrations"."webhook_inbound_logs"("provider_key", "received_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON "integrations"."webhook_inbound_logs" TO crm_app;
