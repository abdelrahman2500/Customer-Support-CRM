-- Story 138 — Arabic Knowledge Base full-text search.
--
-- Additive only: one partial expression index. Zero DROP, zero ALTER of any
-- existing column, constraint, index or referential action. Story 102's
-- `knowledge_base_articles.search_vector` generated column and its GIN index
-- are deliberately untouched.
--
-- Hand-written rather than generated, following this repository's standing
-- convention (see 20260916000000_add_customer_contact_anonymized_at): `prisma
-- migrate dev` repeatedly misreads `search_vector` as plain-column drift and
-- emits destructive statements alongside the intended change.
--
-- PARTIAL on `locale = 'AR'`: the query always filters on that same predicate,
-- and PostgreSQL was confirmed (EXPLAIN, 20k rows) to prove the implication
-- and choose a Bitmap Index Scan. The index expression below must stay
-- character-for-character identical to the one in
-- `KnowledgeBaseService.searchArticlesInArabic`, or the planner cannot match
-- it.
--
-- `title`/`body` are NOT NULL on this table, so no `coalesce()` — unlike
-- Story 102's expression over the nullable base-article columns.
--
-- `arabic` is a built-in PostgreSQL text-search configuration (the core
-- `arabic_stem` Snowball dictionary); no extension is required.
CREATE INDEX "knowledge_base_article_translations_arabic_fts_idx"
  ON "knowledge_base"."knowledge_base_article_translations"
  USING GIN (to_tsvector('arabic', "title" || ' ' || "body"))
  WHERE "locale" = 'AR';
