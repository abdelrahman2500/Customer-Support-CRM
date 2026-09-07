-- RM-05 — the `DROP INDEX .../ALTER COLUMN "search_vector" DROP DEFAULT`
-- Prisma's diff engine generated ahead of this point were removed by hand:
-- the same documented false positive against
-- `knowledge_base.knowledge_base_articles.search_vector` (a real Postgres
-- GENERATED ALWAYS AS (...) STORED column) already worked around in
-- RM-00's, RM-02's, RM-03's, Story 109's, Story 110's, and Story 115's own
-- migrations — this schema change (a new, unrelated table in a different
-- schema) has nothing to do with that column.

-- CreateTable
CREATE TABLE "ticketing"."ticket_knowledge_base_references" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "referenced_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_knowledge_base_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_knowledge_base_references_ticket_id_idx" ON "ticketing"."ticket_knowledge_base_references"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_knowledge_base_references_article_id_idx" ON "ticketing"."ticket_knowledge_base_references"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_knowledge_base_references_ticket_id_article_id_key" ON "ticketing"."ticket_knowledge_base_references"("ticket_id", "article_id");

-- AddForeignKey
ALTER TABLE "ticketing"."ticket_knowledge_base_references" ADD CONSTRAINT "ticket_knowledge_base_references_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketing"."ticket_knowledge_base_references" ADD CONSTRAINT "ticket_knowledge_base_references_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_base"."knowledge_base_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketing"."ticket_knowledge_base_references" ADD CONSTRAINT "ticket_knowledge_base_references_referenced_by_user_id_fkey" FOREIGN KEY ("referenced_by_user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
