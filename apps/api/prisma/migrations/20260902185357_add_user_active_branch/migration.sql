-- Story 118 — the two lines this section would otherwise contain (a
-- spurious DROP INDEX + ALTER COLUMN DROP DEFAULT on
-- "knowledge_base"."knowledge_base_articles"."search_vector") are
-- discarded: the same known false-positive Prisma's schema-diff engine
-- produces against Story 102's `Unsupported("tsvector")` generated
-- column every time, already documented and worked around in Stories
-- 109, 115, and 117's own migrations.

-- AlterTable
ALTER TABLE "identity"."users" ADD COLUMN     "active_branch_id" TEXT,
ADD COLUMN     "active_department_id" TEXT;
