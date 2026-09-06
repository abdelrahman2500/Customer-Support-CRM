-- RM-00 — AI Suggested Solutions.
--
-- Hand-written rather than `prisma migrate dev`-generated: this repo's
-- `knowledge_base.knowledge_base_articles.search_vector` column is a real
-- Postgres GENERATED ALWAYS AS (...) STORED column (added by an earlier,
-- also-hand-written migration; the column is declared `Unsupported
-- ("tsvector")` in schema.prisma, which cannot express a generated
-- column). `prisma migrate dev`'s diff engine does not understand this
-- and always proposes `DROP INDEX ...search_vector_idx` +
-- `ALTER COLUMN search_vector DROP DEFAULT` alongside any unrelated
-- schema change — the latter statement is invalid Postgres syntax for a
-- generated column ("column is a generated column. HINT: Use ALTER
-- TABLE ... ALTER COLUMN ... DROP EXPRESSION instead") and fails the
-- whole migration. This is pre-existing drift between Prisma's schema
-- model and the real DB, unrelated to this story; confirmed via direct
-- query that no part of the failed auto-generated attempt was actually
-- applied. Per CLAUDE.md §4, resolved by writing only the two statements
-- this story actually needs, leaving the KB full-text search index
-- completely untouched.

-- AlterEnum
ALTER TYPE "ai"."AiFeature" ADD VALUE 'SUGGEST_SOLUTIONS';

-- AlterTable
ALTER TABLE "ai"."ai_settings" ADD COLUMN     "suggest_solutions_enabled" BOOLEAN NOT NULL DEFAULT true;
