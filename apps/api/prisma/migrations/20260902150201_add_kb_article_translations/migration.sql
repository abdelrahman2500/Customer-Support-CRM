-- CreateEnum
CREATE TYPE "knowledge_base"."KbLocale" AS ENUM ('EN', 'AR');

-- Story 109 — Prisma's schema-diff engine misreads `search_vector`
-- (Story 102's `Unsupported("tsvector")` generated column) as plain-column
-- drift on every subsequent `migrate dev` run, and would otherwise emit an
-- invalid `DROP INDEX .../ALTER COLUMN ... DROP DEFAULT` pair here —
-- Postgres rejects `DROP DEFAULT` on a generated column outright (a
-- confirmed P3018 failure during this story's own migration authoring;
-- neither statement reflects any real, intended schema change). Both
-- removed — the existing GIN index and generated column are completely
-- unrelated to this migration's actual change (the new translations
-- table below) and must be left exactly as Story 102 created them.

-- CreateTable
CREATE TABLE "knowledge_base"."knowledge_base_article_translations" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "locale" "knowledge_base"."KbLocale" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_article_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_base_article_translations_article_id_idx" ON "knowledge_base"."knowledge_base_article_translations"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_base_article_translations_article_id_locale_key" ON "knowledge_base"."knowledge_base_article_translations"("article_id", "locale");

-- AddForeignKey
ALTER TABLE "knowledge_base"."knowledge_base_article_translations" ADD CONSTRAINT "knowledge_base_article_translations_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_base"."knowledge_base_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
