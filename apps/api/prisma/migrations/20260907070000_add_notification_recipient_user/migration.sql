-- RM-06 — the `DROP INDEX .../ALTER COLUMN "search_vector" DROP DEFAULT`
-- Prisma's diff engine generated ahead of this point were removed by hand:
-- the same documented false positive against
-- `knowledge_base.knowledge_base_articles.search_vector` already worked
-- around in RM-00's, RM-02's, RM-03's, RM-05's, Story 109's, Story 110's,
-- and Story 115's own migrations — this schema change (a nullable column
-- on an unrelated table in a different schema) has nothing to do with
-- that column.

-- AlterTable
ALTER TABLE "notifications"."notification_logs" ADD COLUMN     "recipient_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "notifications"."notification_logs" ADD CONSTRAINT "notification_logs_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
