-- Story 104 — supports the branch-scoped, `createdAt`-ordered, capped
-- query `AuditLogsService.listAuditLogs` now always runs.
--
-- Note: Prisma's own migration-diff engine additionally proposed
-- dropping Story 102's `knowledge_base_articles_search_vector_idx` GIN
-- index and the `search_vector` generated column's default — the same
-- spurious diff already documented in Story 103's migration (Prisma's
-- shadow-database diff doesn't understand a raw-SQL `GENERATED ALWAYS AS
-- (...) STORED` column represented as `Unsupported("tsvector")`).
-- Deliberately NOT included here.

-- CreateIndex
CREATE INDEX "audit_logs_branch_id_created_at_idx" ON "admin"."audit_logs"("branch_id", "created_at");
