-- RM-22 — API-Key Authentication for Machine-to-Machine Consumers.
--
-- Hand-written, not `prisma migrate dev`-generated: this repo's
-- `knowledge_base.knowledge_base_articles.search_vector` column is a real
-- Postgres GENERATED ALWAYS AS (...) STORED column that Prisma's diff
-- engine always misreads as needing an invalid `ALTER COLUMN ... DROP
-- DEFAULT` alongside any unrelated schema change — the same known
-- false-positive already worked around in every prior migration this
-- session (most recently RM-21's own `add_webhook_inbound_log`).
-- Confirmed (again) via direct DB query before writing this file that no
-- such statement belongs here.
--
-- No `CREATE SCHEMA` here — `integrations` already exists (RM-20). Story
-- 115's `add_runtime_db_role_grants` + RM-20's own `ALTER DEFAULT
-- PRIVILEGES ... IN SCHEMA "integrations"` already covers this new table
-- automatically; the explicit per-table GRANT below is a defensive,
-- always-safe belt-and-suspenders confirmation, not a required addition.

-- CreateTable
CREATE TABLE "integrations"."api_keys" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hashed_key" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "scopes" TEXT[],
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hashed_key_key" ON "integrations"."api_keys"("hashed_key");

-- CreateIndex
CREATE INDEX "api_keys_branch_id_idx" ON "integrations"."api_keys"("branch_id");

-- AddForeignKey
ALTER TABLE "integrations"."api_keys" ADD CONSTRAINT "api_keys_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations"."api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON "integrations"."api_keys" TO crm_app;
