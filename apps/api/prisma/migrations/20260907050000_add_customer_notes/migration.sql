-- RM-02 — Customer Notes.
--
-- Hand-written, not `prisma migrate dev`-generated: this repo's
-- `knowledge_base.knowledge_base_articles.search_vector` column is a real
-- Postgres GENERATED ALWAYS AS (...) STORED column that Prisma's diff
-- engine always misreads as needing an invalid `ALTER COLUMN ... DROP
-- DEFAULT` alongside any unrelated schema change — the same known
-- false-positive already documented and worked around in RM-00's, RM-03's,
-- Story 109's, Story 110's, and Story 115's own migrations.
--
-- No new Postgres schema and no GRANT statements needed here (unlike
-- RM-03's `add_tasks` migration): `customer_notes` lives in the existing
-- "customers" schema, whose `ALTER DEFAULT PRIVILEGES FOR ROLE crm IN
-- SCHEMA "customers"` clause (Story 115's `add_runtime_db_role_grants`)
-- already covers any future table any migration adds there — confirmed
-- directly against the running database before writing this file.

-- CreateTable
CREATE TABLE "customers"."customer_notes" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_notes_customer_id_idx" ON "customers"."customer_notes"("customer_id");

-- AddForeignKey
ALTER TABLE "customers"."customer_notes" ADD CONSTRAINT "customer_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers"."customer_notes" ADD CONSTRAINT "customer_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
