-- RM-27 — Knowledge Base Category Taxonomy
--
-- Replaces the free-text `knowledge_base_articles.category` column with a
-- real, branch-scoped `knowledge_base.knowledge_base_categories` foreign
-- key, mirroring Story 120's `ticket_categories` migration exactly.
-- Zero-loss backfill: one `KnowledgeBaseCategory` row is created per exact,
-- distinct (branch_id, category) pair found in the legacy column — no
-- normalization, no merging of differently-cased/-spelled values. Every
-- existing article is repointed at its own matching new row via a plain
-- string-equality join, and only then is the old free-text column dropped.
--
-- `knowledge_base_article_versions.category` is a deliberately-kept,
-- untouched immutable name *snapshot* at publish time (not a live FK) —
-- see that column's own doc comment in schema.prisma — so this migration
-- performs no ALTER of any kind on that table.

-- CreateTable
CREATE TABLE "knowledge_base"."knowledge_base_categories" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_base_categories_branch_id_name_key" ON "knowledge_base"."knowledge_base_categories"("branch_id", "name");

-- AddForeignKey
ALTER TABLE "knowledge_base"."knowledge_base_categories" ADD CONSTRAINT "knowledge_base_categories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add the new nullable category_id column alongside the
-- still-present legacy free-text `category` column (both exist
-- simultaneously during backfill).
ALTER TABLE "knowledge_base"."knowledge_base_articles" ADD COLUMN "category_id" TEXT;

-- Backfill: one knowledge_base_categories row per exact, distinct
-- (branch_id, category) pair. The DISTINCT in the subquery collapses the
-- exact same string appearing more than once for the same branch; two
-- differently-cased or -spelled strings never collapse, by design —
-- nothing here normalizes or merges data.
INSERT INTO "knowledge_base"."knowledge_base_categories" ("id", "branch_id", "name", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), "distinct_values"."branch_id", "distinct_values"."category", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "branch_id", "category" FROM "knowledge_base"."knowledge_base_articles" WHERE "category" IS NOT NULL
) AS "distinct_values"("branch_id", "category");

-- Repoint every existing article at its own matching new category row via
-- a plain string-equality join (same exact-match semantics the legacy
-- column always had — this migration changes what type of value is
-- compared, from a string to a stable id, not the matching rule itself).
UPDATE "knowledge_base"."knowledge_base_articles" AS "a"
SET "category_id" = "kbc"."id"
FROM "knowledge_base"."knowledge_base_categories" AS "kbc"
WHERE "a"."category" IS NOT NULL
  AND "kbc"."branch_id" = "a"."branch_id"
  AND "kbc"."name" = "a"."category";

-- Drop the legacy free-text column only now that every row referencing a
-- non-null value has been confirmed repointed to a real
-- knowledge_base_categories row. `knowledge_base_article_versions.category`
-- is untouched — see this migration's own header comment above.
ALTER TABLE "knowledge_base"."knowledge_base_articles" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "knowledge_base_articles_category_id_idx" ON "knowledge_base"."knowledge_base_articles"("category_id");

-- AddForeignKey
ALTER TABLE "knowledge_base"."knowledge_base_articles" ADD CONSTRAINT "knowledge_base_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "knowledge_base"."knowledge_base_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
