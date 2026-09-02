-- Story 102 — Knowledge Base full-text search.
--
-- Generated column, not a plain one: Postgres computes and maintains this
-- value itself on every INSERT/UPDATE of title/body, and computes every
-- existing row's value as part of this ALTER TABLE itself — no separate
-- backfill UPDATE, and no application code ever writes to this column
-- (Prisma's own `Unsupported("tsvector")` field type guarantees the
-- client never attempts to).
ALTER TABLE "knowledge_base"."knowledge_base_articles"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce("title", '') || ' ' || coalesce("body", ''))
  ) STORED;

-- GIN is the standard index type for tsvector containment (`@@`) queries.
CREATE INDEX "knowledge_base_articles_search_vector_idx"
  ON "knowledge_base"."knowledge_base_articles"
  USING GIN ("search_vector");
